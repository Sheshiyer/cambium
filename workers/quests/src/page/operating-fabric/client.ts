// cambium-quests · operating fabric boot client (Task 6 additive bundle).
// Starts inert: it probes the tenant mission-fabric route once with the
// runtime Telegram initData, and activates the shell ONLY for an
// authenticated 200 whose delivery.operatingFabricEnabled is exactly true.
// Every other outcome — 401, 403, network failure, malformed JSON, absent
// delivery, explicit false, or merely truthy flags — leaves the shell hidden
// and inert with the legacy document visible. initData never touches the
// DOM, storage, or logs; this client holds no authorization logic.
export const OPERATING_FABRIC_BOOT = `<script data-operating-fabric-boot>
(function () {
  // The shell ships as real DOM, hidden and inert; boot only un-hides it.
  var root = document.getElementById('operating-fabric');
  if (!root) return;
  // The legacy shell is selected by its existing component marker, never by
  // modified legacy markup.
  var legacy = document.querySelector('[data-component="MissionControlShell"]');
  // No runtime initData means no authenticated response is possible; the
  // probe is skipped entirely and the shell stays hidden and inert.
  var TG = (window.Telegram && window.Telegram.WebApp) || null;
  var initData = (TG && TG.initData) || '';
  if (!initData) return;
  var tenant = (typeof TENANT === 'string' && TENANT) || 'cambium';
  function activate() {
    root.hidden = false;
    root.classList.add('of-on');
    root.inert = false;
    root.setAttribute('aria-hidden', 'false');
    if (typeof root.toggle === 'function') root.toggle(false, false);
    if (legacy) legacy.classList.add('of-active');
  }
  fetch('/v1/mission-fabric/' + tenant, { headers: { 'x-telegram-init-data': initData } })
    .then(function (res) {
      if (!res.ok) return;
      return res.json().then(function (body) {
        if (body && body.delivery && body.delivery.operatingFabricEnabled === true) activate();
      });
    })
    .catch(function () { /* inert by default: legacy stays visible */ });
})();
</script>
`;
