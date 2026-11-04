import XCTest
@testable import CambiumCore
private struct PilotSession: SessionProvider {
    func currentSession() async -> NativeSession { .verified(founderId: "founder", tenantId: "cambium", expiresAt: .distantFuture) }
}
private struct PilotAuth: RequestAuthorizer { func headers() async throws -> [String: String] { ["authorization": "Bearer fixture"] } }
private actor PilotTransport: HTTPTransport {
    let object: Data
    var requests: [HTTPRequest] = []
    init(_ value: Data) { object = value }
    func send(_ request: HTTPRequest) async throws -> HTTPResponse { requests.append(request); return HTTPResponse(status: 200, body: object) }
    func captured() -> [HTTPRequest] { requests }
}
private func wireTransport(_ value: [String: Any]) throws -> PilotTransport { PilotTransport(try JSONSerialization.data(withJSONObject: value)) }
final class DirectionExecutionTests: XCTestCase {
    private func client(_ transport: PilotTransport) throws -> DirectionHTTPClient {
        DirectionHTTPClient(origin: try HTTPOriginPolicy(url: XCTUnwrap(URL(string: "https://owner.invalid/prefix"))), transport: transport, authorizer: PilotAuth(), sessionProvider: PilotSession())
    }
    private func direction() throws -> SharedDirection {
        try JSONDecoder().decode(SharedDirection.self, from: JSONSerialization.data(withJSONObject: ["id":"direction-1","tenantId":"cambium","principal":"founder","title":"Improve title validation","body":"Bounded change.","workObjectId":"sapling:cambium","workNodeId":"goal-node","graphHeadDigest":String(repeating:"a",count:64),"signalPins":[["id":"signal-1","revision":3]],"revision":1,"createdAt":"2026-11-04T00:00:00.000Z","updatedAt":"2026-11-04T00:00:00.000Z"]))
    }
    private func preview() -> [String: Any] {
        ["schema":"cambium.direction-execution-preview.v1","tenantId":"cambium","principal":"founder","directionId":"direction-1","directionRevision":1,"expectedHeadDigest":String(repeating:"a",count:64),"policyDigest":"sha256:"+String(repeating:"b",count:64),"writerAuthority":false,"executionGranted":false,"summary":["objective":"Improve title validation","artifact":"Two-file patch and tests","baseCommit":String(repeating:"c",count:40),"patchDigest":"sha256:"+String(repeating:"d",count:64),"allowedPaths":["workers/quests/src/shared-signals.ts","workers/quests/src/shared-signals.test.ts"],"check":"node --test workers/quests/src/shared-signals.test.ts","timeoutSeconds":180,"modelPool":"noesis-free","acceptance":"review-required","externalActions":"none"]]
    }
    func testPreviewKeepsOwnerBasePathAndRejectsScopeRevisionOrPolicySubstitution() async throws {
        let good = try wireTransport(preview()); let p = try await client(good).executionPreview(tenant:"cambium",direction:direction())
        XCTAssertEqual(p.summary.modelPool,"noesis-free"); let sent = await good.captured(); XCTAssertEqual(sent.first?.url.path,"/prefix/v1/directions/cambium/direction-1/execution-review")
        for key in ["principal","directionRevision","summary"] {
            var value=preview()
            if key == "principal" { value[key]="other" }
            if key == "directionRevision" { value[key]=2 }
            if key == "summary" { var summary=value[key] as! [String:Any];summary["modelPool"]="noesis-a";value[key]=summary }
            let bad = try wireTransport(value)
            do { _ = try await client(bad).executionPreview(tenant:"cambium",direction:direction()); XCTFail("Substitution accepted") } catch { XCTAssertEqual(error as? SignalError,.invalid) }
        }
    }
    func testPrepareEchoBindsDirectionRevisionAndCanonicalProposalWithStableOperation() async throws {
        let p = try JSONDecoder().decode(DirectionExecutionPreview.self,from:JSONSerialization.data(withJSONObject:preview()))
        let value = DirectionExecutionPrepare(operationId:"prepare-1",preview:p), digest=String(repeating:"e",count:64)
        let transport=try wireTransport(["schema":"cambium.direction-proposal.v1","workObjectId":"sapling:cambium","tenantId":"cambium","principal":"founder","directionId":"direction-1","directionRevision":1,"proposalId":"cambium:"+digest,"changeDigest":digest,"duplicate":true,"writerAuthority":false,"executionGranted":false])
        _ = try await client(transport).prepareExecution(tenant:"cambium",directionId:"direction-1",value:value)
        _ = try await client(transport).prepareExecution(tenant:"cambium",directionId:"direction-1",value:value)
        let sent=await transport.captured();XCTAssertEqual(sent.count,2)
        for request in sent { let body=try XCTUnwrap(JSONSerialization.jsonObject(with: XCTUnwrap(request.body)) as? [String:Any]);XCTAssertEqual(body["operationId"] as? String,"prepare-1");XCTAssertNil(body["principal"]);XCTAssertEqual(request.url.path,"/prefix/v1/directions/cambium/direction-1/proposal") }
    }
    func testAdmissionCannotClaimAnImplicitLaunchOrBothReadyAndConsumed() async throws {
        let id="cambium:"+String(repeating:"e",count:64)
        for launched in [false,true] {
            let transport=try wireTransport(["schema":"cambium.direction-admission.v1","tenantId":"cambium","principal":"founder","proposalId":id,"admissionRef":"nda_"+String(repeating:"f",count:64),"workObjectId":"sapling:cambium","expiresAt":"2026-11-05T00:00:00.000Z","status":"admitted","launchReady":true,"consumed":false,"admissionGranted":true,"launched":launched])
            do { _ = try await client(transport).admitExecution(tenant:"cambium",proposalId:id);XCTAssertFalse(launched) } catch { XCTAssertTrue(launched);XCTAssertEqual(error as? SignalError,.invalid) }
            let sent=await transport.captured();XCTAssertEqual(sent.first?.url.path,"/prefix/v1/direction-executions/cambium/admit")
        }
    }
    func testResultReadBindsOriginalAttemptAndNeverTreatsPendingAsReady() async throws {
        let value: [String: Any] = ["schema":"cambium.direction-result.v1","tenantId":"cambium","principal":"founder",
            "requestId":"request-1","attemptId":"attempt-1","directionId":"direction-1","directionRevision":1,
            "title":"Improve title validation","workObjectId":"sapling:cambium","inputDigest":"sha256:"+String(repeating:"a",count:64),
            "policyDigest":"sha256:"+String(repeating:"b",count:64),"state":"pending","result":NSNull(),"outputDigest":NSNull(),
            "acceptance":"review-required","externalActions":"none"]
        let transport = try wireTransport(value)
        let result = try await client(transport).executionResult(tenant:"cambium",requestId:"request-1",attemptId:"attempt-1")
        XCTAssertEqual(result.state,"pending"); XCTAssertNil(result.result)
        let sent = await transport.captured(); XCTAssertEqual(sent.first?.url.path,"/prefix/v1/direction-executions/cambium/request-1/result")
        for (key, replacement) in [("attemptId","other"),("state","result-ready"),("acceptance","accepted"),("principal","other")] {
            var changed = value; changed[key] = replacement
            let bad = try wireTransport(changed)
            do { _ = try await client(bad).executionResult(tenant:"cambium",requestId:"request-1",attemptId:"attempt-1"); XCTFail("Unbound result accepted") }
            catch { XCTAssertEqual(error as? SignalError,.invalid) }
        }
    }

    func testCodeResultVerifiesJavaScriptDigestAndRejectsTamperedDiffOrLogs() async throws {
        let url = try XCTUnwrap(Bundle.module.url(forResource:"direction-code-result",withExtension:"json",subdirectory:"Fixtures"))
        let data = try Data(contentsOf:url), transport = PilotTransport(data)
        let result = try await client(transport).executionResult(tenant:"cambium",requestId:"request-1",attemptId:"attempt-1")
        XCTAssertEqual(result.state,"result-ready"); XCTAssertEqual(result.result?.candidateExitCode,0)
        let base = try XCTUnwrap(JSONSerialization.jsonObject(with:data) as? [String:Any])
        for field in ["diffBase64","candidateLog"] {
            var changed = base, code = try XCTUnwrap(base["result"] as? [String:Any]); code[field] = "tampered"; changed["result"] = code
            let bad = try wireTransport(changed)
            do { _ = try await client(bad).executionResult(tenant:"cambium",requestId:"request-1",attemptId:"attempt-1"); XCTFail("Tampered result accepted") }
            catch { XCTAssertEqual(error as? SignalError,.invalid) }
        }
    }

}
