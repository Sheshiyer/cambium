// cambium-quests · operating fabric fragment (Task 6 additive bundle).
// The only export consumed by the page assembler: one contiguous fragment of
// honest DOM — hidden/inert shell markup followed by its own separate inline
// boot script — inserted verbatim before the legacy </body>.
import { OPERATING_FABRIC_MARKUP } from './scaffold.ts';
import { OPERATING_FABRIC_BOOT } from './client.ts';

export const OPERATING_FABRIC_PAGE =
  OPERATING_FABRIC_MARKUP +
  OPERATING_FABRIC_BOOT;
