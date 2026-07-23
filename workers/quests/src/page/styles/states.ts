// cambium-quests · miniapp page chunk — skeleton/empty/error/offline state CSS + </style>
// Verbatim slice of the served PAGE string (T-009 pure refactor of the page.ts monolith).
// Moves only: no copy, style, behavior, or ordering changes. Assembly order: page/index.ts.
export const STYLE_STATES = `  /* ── skeleton / states ──────────────────────── */
  .skel{height:54px;border-bottom:1px solid var(--line);position:relative;overflow:hidden}
  .skel::after{content:"";position:absolute;inset:0;transform:translateX(-100%);
    background:linear-gradient(90deg,transparent,rgba(214,255,246,.06),transparent);
    animation:shimmer 1.4s var(--ease) infinite}
  @keyframes shimmer{to{transform:translateX(100%)}}
  .state{padding:46px 6px;text-align:left;opacity:.85}
  .state b{display:block;color:var(--ink);margin-bottom:6px;font-size:15px}
  .state p{opacity:.8;margin-bottom:10px;line-height:1.5}
  .state code{font:12px var(--mono);opacity:.85;background:rgba(214,255,246,.06);padding:3px 7px;border-radius:6px}
  .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
  .scene-chip{border:1px solid var(--line);background:rgba(224,255,79,.08);color:var(--ink);font:11px var(--mono);cursor:pointer}

  footer{flex:none;padding:8px 18px calc(var(--sab) + 12px);
    font:10.5px var(--mono);opacity:.5;background:linear-gradient(transparent,var(--bg) 45%);z-index:2;pointer-events:none}

	  @media (max-width:480px){
	    header.root-status{grid-template-columns:minmax(0,1fr)}
	    .root-chip-stack{width:100%;justify-content:flex-start}
	  }

	  @media (max-width:350px){
	    header.root-status{padding-left:14px;padding-right:14px}
	    .root-nav{margin-left:12px;margin-right:12px}
	    .scene{padding-left:14px;padding-right:14px}
	    .mission-tool-link,.maphead{grid-template-columns:1fr}
	    .mission-tool-link button{width:100%}
	    .mapbadge{justify-self:start;max-width:100%;overflow:hidden;text-overflow:ellipsis}
	    .kv{grid-template-columns:76px minmax(0,1fr);gap:7px 8px}
	  }

	  @media (prefers-reduced-motion: reduce){
	    *{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}
	    .mc-orbit::after,.mc-packet-dots[data-motion="packetDrift"],.mc-glyph[data-motion="glyphBreathe"] svg,.mc-state-token{animation:none!important}
	  }
</style>
`;
