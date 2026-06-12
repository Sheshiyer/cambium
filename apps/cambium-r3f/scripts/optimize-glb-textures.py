#!/usr/bin/env python3
import argparse
from array import array
import io
import json
import math
import struct
from pathlib import Path

from PIL import Image

JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942
GLB_MAGIC = 0x46546C67
GLB_VERSION = 2

COMPONENT_SIZES = {
    5123: 2,
    5125: 4,
    5126: 4,
}

ACCESSOR_COMPONENTS = {
    "SCALAR": 1,
    "VEC2": 2,
    "VEC3": 3,
}


def align4(length: int) -> int:
    return (4 - (length % 4)) % 4


def read_glb(path: Path):
    data = path.read_bytes()
    if len(data) < 20:
        raise ValueError(f"{path} is too small to be a GLB")
    magic, version, total_length = struct.unpack_from("<III", data, 0)
    if magic != GLB_MAGIC or version != GLB_VERSION:
        raise ValueError(f"{path} is not a GLB v2 file")
    if total_length != len(data):
        raise ValueError(f"{path} length header does not match file size")

    offset = 12
    json_chunk = None
    bin_chunk = None
    while offset < len(data):
        chunk_length, chunk_type = struct.unpack_from("<II", data, offset)
        offset += 8
        chunk = data[offset:offset + chunk_length]
        offset += chunk_length
        if chunk_type == JSON_CHUNK:
            json_chunk = chunk
        elif chunk_type == BIN_CHUNK:
            bin_chunk = chunk

    if json_chunk is None or bin_chunk is None:
        raise ValueError(f"{path} must contain JSON and BIN chunks")
    return json.loads(json_chunk.decode("utf8")), bytearray(bin_chunk)


def encode_image(source: bytes, mime_type: str, max_size: int, jpeg_quality: int):
    image = Image.open(io.BytesIO(source))
    original_size = image.size
    resized = image.copy()
    resized.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)

    out = io.BytesIO()
    if mime_type == "image/jpeg":
        if resized.mode not in ("RGB", "L"):
            resized = resized.convert("RGB")
        resized.save(out, format="JPEG", quality=jpeg_quality, optimize=True, progressive=True)
    else:
        if resized.mode == "P":
            resized = resized.convert("RGBA")
        resized.save(out, format="PNG", optimize=True)

    return out.getvalue(), {
        "mimeType": mime_type,
        "originalWidth": original_size[0],
        "originalHeight": original_size[1],
        "optimizedWidth": resized.size[0],
        "optimizedHeight": resized.size[1],
        "originalBytes": len(source),
        "optimizedBytes": out.tell(),
    }


def accessor_payload(document, bin_chunk, accessor_index: int):
    accessor = document["accessors"][accessor_index]
    view = document["bufferViews"][accessor["bufferView"]]
    component_size = COMPONENT_SIZES[accessor["componentType"]]
    component_count = ACCESSOR_COMPONENTS[accessor["type"]]
    byte_offset = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    byte_length = accessor["count"] * component_size * component_count
    return bytes(bin_chunk[byte_offset:byte_offset + byte_length])


def float_array_from_accessor(document, bin_chunk, accessor_index: int):
    accessor = document["accessors"][accessor_index]
    if accessor["componentType"] != 5126:
        raise ValueError(f"Accessor {accessor_index} must be FLOAT for geometry clustering")
    values = array("f")
    values.frombytes(accessor_payload(document, bin_chunk, accessor_index))
    return values


def index_array_from_accessor(document, bin_chunk, accessor_index: int):
    accessor = document["accessors"][accessor_index]
    if accessor["componentType"] == 5125:
        values = array("I")
    elif accessor["componentType"] == 5123:
        values = array("H")
    else:
        raise ValueError(f"Accessor {accessor_index} must be UNSIGNED_INT or UNSIGNED_SHORT for indices")
    values.frombytes(accessor_payload(document, bin_chunk, accessor_index))
    return values


def array_bytes(values):
    return values.tobytes()


def cluster_geometry(document, bin_chunk, grid_size: int):
    if grid_size <= 1:
        raise ValueError("--cluster-grid must be greater than 1")
    mesh = document["meshes"][0]
    primitive = mesh["primitives"][0]
    position_accessor_index = primitive["attributes"]["POSITION"]
    normal_accessor_index = primitive["attributes"]["NORMAL"]
    uv_accessor_index = primitive["attributes"]["TEXCOORD_0"]
    index_accessor_index = primitive["indices"]

    positions = float_array_from_accessor(document, bin_chunk, position_accessor_index)
    normals = float_array_from_accessor(document, bin_chunk, normal_accessor_index)
    uvs = float_array_from_accessor(document, bin_chunk, uv_accessor_index)
    indices = index_array_from_accessor(document, bin_chunk, index_accessor_index)

    vertex_count = document["accessors"][position_accessor_index]["count"]
    pos_accessor = document["accessors"][position_accessor_index]
    min_xyz = pos_accessor.get("min") or [
        min(positions[axis::3]) for axis in range(3)
    ]
    max_xyz = pos_accessor.get("max") or [
        max(positions[axis::3]) for axis in range(3)
    ]
    span = [max(max_xyz[axis] - min_xyz[axis], 0.000001) for axis in range(3)]

    clusters = []
    cluster_by_key = {}
    remap = array("I", [0]) * vertex_count

    for vertex in range(vertex_count):
        px = positions[vertex * 3]
        py = positions[vertex * 3 + 1]
        pz = positions[vertex * 3 + 2]
        key = (
            min(grid_size - 1, max(0, int((px - min_xyz[0]) / span[0] * grid_size))),
            min(grid_size - 1, max(0, int((py - min_xyz[1]) / span[1] * grid_size))),
            min(grid_size - 1, max(0, int((pz - min_xyz[2]) / span[2] * grid_size))),
        )
        cluster_index = cluster_by_key.get(key)
        if cluster_index is None:
            cluster_index = len(clusters)
            cluster_by_key[key] = cluster_index
            clusters.append([0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0])
        remap[vertex] = cluster_index
        cluster = clusters[cluster_index]
        cluster[0] += px
        cluster[1] += py
        cluster[2] += pz
        cluster[3] += normals[vertex * 3]
        cluster[4] += normals[vertex * 3 + 1]
        cluster[5] += normals[vertex * 3 + 2]
        cluster[6] += uvs[vertex * 2]
        cluster[7] += uvs[vertex * 2 + 1]
        cluster[8] += 1

    new_positions = array("f")
    new_normals = array("f")
    new_uvs = array("f")
    for cluster in clusters:
        count = cluster[8]
        new_positions.extend([cluster[0] / count, cluster[1] / count, cluster[2] / count])
        nx = cluster[3] / count
        ny = cluster[4] / count
        nz = cluster[5] / count
        normal_length = math.sqrt(nx * nx + ny * ny + nz * nz) or 1.0
        new_normals.extend([nx / normal_length, ny / normal_length, nz / normal_length])
        new_uvs.extend([cluster[6] / count, cluster[7] / count])

    index_type = "H" if len(clusters) <= 65535 else "I"
    new_indices = array(index_type)
    seen = set()
    dropped_degenerate = 0
    dropped_duplicate = 0
    for triangle in range(0, len(indices), 3):
        a = remap[indices[triangle]]
        b = remap[indices[triangle + 1]]
        c = remap[indices[triangle + 2]]
        if a == b or b == c or a == c:
            dropped_degenerate += 1
            continue
        key = tuple(sorted((a, b, c)))
        if key in seen:
            dropped_duplicate += 1
            continue
        seen.add(key)
        new_indices.extend([a, b, c])

    geometry_payloads = {
        document["accessors"][position_accessor_index]["bufferView"]: array_bytes(new_positions),
        document["accessors"][normal_accessor_index]["bufferView"]: array_bytes(new_normals),
        document["accessors"][uv_accessor_index]["bufferView"]: array_bytes(new_uvs),
        document["accessors"][index_accessor_index]["bufferView"]: array_bytes(new_indices),
    }

    new_position_values = [new_positions[axis::3] for axis in range(3)]
    document["accessors"][position_accessor_index]["count"] = len(clusters)
    document["accessors"][position_accessor_index]["min"] = [min(values) for values in new_position_values]
    document["accessors"][position_accessor_index]["max"] = [max(values) for values in new_position_values]
    document["accessors"][position_accessor_index]["byteOffset"] = 0
    document["accessors"][normal_accessor_index]["count"] = len(clusters)
    document["accessors"][normal_accessor_index]["byteOffset"] = 0
    document["accessors"][uv_accessor_index]["count"] = len(clusters)
    document["accessors"][uv_accessor_index]["byteOffset"] = 0
    document["accessors"][index_accessor_index]["count"] = len(new_indices)
    document["accessors"][index_accessor_index]["componentType"] = 5123 if index_type == "H" else 5125
    document["accessors"][index_accessor_index]["min"] = [min(new_indices) if new_indices else 0]
    document["accessors"][index_accessor_index]["max"] = [max(new_indices) if new_indices else 0]
    document["accessors"][index_accessor_index]["byteOffset"] = 0

    return geometry_payloads, {
        "clusterGrid": grid_size,
        "sourceVertices": vertex_count,
        "optimizedVertices": len(clusters),
        "sourceTriangles": len(indices) // 3,
        "optimizedTriangles": len(new_indices) // 3,
        "droppedDegenerateTriangles": dropped_degenerate,
        "droppedDuplicateTriangles": dropped_duplicate,
        "indexComponentType": 5123 if index_type == "H" else 5125,
    }


def optimize_glb(input_path: Path, output_path: Path, max_size: int, jpeg_quality: int, cluster_grid: int | None):
    document, bin_chunk = read_glb(input_path)
    buffer_views = document.get("bufferViews", [])
    original_buffer_views = [dict(view) for view in buffer_views]
    images = document.get("images", [])
    replacements = {}
    image_report = []
    geometry_report = None

    if cluster_grid:
        geometry_payloads, geometry_report = cluster_geometry(document, bin_chunk, cluster_grid)
        replacements.update(geometry_payloads)

    for index, image in enumerate(images):
        buffer_view_index = image.get("bufferView")
        mime_type = image.get("mimeType")
        if buffer_view_index is None or not mime_type:
            continue
        view = buffer_views[buffer_view_index]
        byte_offset = view.get("byteOffset", 0)
        byte_length = view["byteLength"]
        source = bytes(bin_chunk[byte_offset:byte_offset + byte_length])
        optimized, report = encode_image(source, mime_type, max_size, jpeg_quality)
        replacements[buffer_view_index] = optimized
        image_report.append({"index": index, "bufferView": buffer_view_index, **report})

    rebuilt = bytearray()
    for index, view in enumerate(buffer_views):
        rebuilt.extend(b"\x00" * align4(len(rebuilt)))
        view["byteOffset"] = len(rebuilt)
        if index in replacements:
            payload = replacements[index]
        else:
            old_view = original_buffer_views[index]
            old_offset = old_view.get("byteOffset", 0)
            old_length = old_view["byteLength"]
            payload = bytes(bin_chunk[old_offset:old_offset + old_length])
        view["byteLength"] = len(payload)
        rebuilt.extend(payload)

    document["buffers"][0]["byteLength"] = len(rebuilt)
    json_bytes = json.dumps(document, separators=(",", ":")).encode("utf8")
    json_bytes += b" " * align4(len(json_bytes))
    rebuilt += b"\x00" * align4(len(rebuilt))
    total_length = 12 + 8 + len(json_bytes) + 8 + len(rebuilt)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("wb") as handle:
        handle.write(struct.pack("<III", GLB_MAGIC, GLB_VERSION, total_length))
        handle.write(struct.pack("<II", len(json_bytes), JSON_CHUNK))
        handle.write(json_bytes)
        handle.write(struct.pack("<II", len(rebuilt), BIN_CHUNK))
        handle.write(rebuilt)

    return {
        "input": str(input_path),
        "output": str(output_path),
        "maxTextureSize": max_size,
        "jpegQuality": jpeg_quality,
        "inputBytes": input_path.stat().st_size,
        "outputBytes": output_path.stat().st_size,
        "geometry": geometry_report,
        "images": image_report,
    }


def main():
    parser = argparse.ArgumentParser(description="Resize embedded GLB textures without changing mesh geometry.")
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--report", type=Path)
    parser.add_argument("--max-size", type=int, default=1536)
    parser.add_argument("--jpeg-quality", type=int, default=84)
    parser.add_argument("--cluster-grid", type=int)
    args = parser.parse_args()

    report = optimize_glb(args.input, args.output, args.max_size, args.jpeg_quality, args.cluster_grid)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
