import { compileDepartmentPilot, observeKpi, type PilotInput, type KpiObservation } from '../../../../shared/department-pilot/pilot.ts';
import { DEPARTMENTS, KPI_DEFINITIONS, LONG_TERM_QUESTIONS, type DepartmentId, type ProductId } from '../../../../shared/department-pilot/catalog.ts';
export interface DepartmentPilotReader {
  input: PilotInput;
  observations?: KpiObservation[];
  readerStatus?: string[];
  sourceKind?: 'authenticated-founder';
  /** Scoped Taste lineage only; host obtains it through prepareTasteContext. */
  taste?: { state: 'supplied' | 'unavailable'; lineage: Array<{ slug: string; category: string; score: number; author: string }> };
}
export interface DepartmentBridge {
  getDepartmentStatus?: () => {state:string;label:string};
  refreshDepartment?: () => Promise<void>;
  getDepartmentState?: () => DepartmentPilotReader | null;
  subscribeDepartment?: (listener: () => void) => () => void;
}
const text = <K extends keyof HTMLElementTagNameMap>(tag: K, content: string, className = ''): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tag); el.textContent = content; el.className = className; return el;
};
/** Read-only folio over the same graph identities; no fetch, signer, timer or mutation surface. */
export function mountDepartmentFolio(host: HTMLElement, bridge: DepartmentBridge): () => void {
  let productId: ProductId = 'lumenbar', department: DepartmentId | 'all' = 'all';
  let horizon: 'all' | 'daily' | 'monthly' | 'quarterly' = 'all', page = 0, disposed = false;
  let selectedId: string | null = null;
  const select = (label: string, values: Array<[string, string]>, current: string, change: (v: string) => void) => {
    const wrap=text('label',label,'cw-dept-filter'), el=document.createElement('select');
    el.setAttribute('aria-label', label);
    for (const [value,label] of values) { const option=text('option',label); option.value=value; option.selected=value===current; el.append(option); }
    el.onchange=()=>{ page=0;selectedId=null;change(el.value);render(); }; wrap.append(el); return wrap;
  };
  function render(): void {
    if(disposed)return;
    const focusLabel = document.activeElement?.getAttribute('aria-label');
    host.replaceChildren(); host.classList.add('cw-departments'); host.setAttribute('aria-label','Department planning pilot');
    host.append(text('p','DEPARTMENT VIEW · READ-ONLY','cw-kicker'));
    const refresh=text('button','Refresh sources','cw-button'); refresh.type='button';
    refresh.onclick=()=>{ if(bridge.refreshDepartment) void bridge.refreshDepartment(); else render(); };
    host.append(refresh);
    let reader: DepartmentPilotReader | null = null;
    try { reader=bridge.getDepartmentState?.()??null; } catch { /* Host reader failure stays unavailable. */ }
    if(!reader) { const status=bridge.getDepartmentStatus?.(); host.append(text('h3',status?.state==='checking'?'Reading department sources…':'Department source reader unavailable'),text('p',status?.label??'The current host has not supplied this pilot’s graph reader. No tasks, measurements or agent assignments are inferred.'));return; }
    let projection: ReturnType<typeof compileDepartmentPilot>;
    try { projection=compileDepartmentPilot({...reader.input,now:new Date().toISOString()}); }
    catch { host.append(text('h3','Source packet held'),text('p','The graph packet failed identity, tenant, time or containment validation. Refresh it through the existing graph owner.'));return; }
    const product=projection.products.find(p=>p.id===productId)!;
    const intro=text('div','','cw-dept-intro');
    intro.append(text('h3',product.label),text('p',`${product.sector} · ${product.nodes.length} existing nodes · ${projection.fresh?'current supplied frontier':'dated or changed frontier'}`));
    host.append(intro);
    const filters=text('div','','cw-dept-filters');
    filters.append(select('Product',projection.products.map(p=>[p.id,p.label]),productId,v=>{productId=v as ProductId;}),
      select('Department',[['all','All departments'],...Object.entries(DEPARTMENTS).map(([id,d]):[string,string]=>[id,d.label])],department,v=>{department=v as DepartmentId|'all';}),
      select('View',[['all','All graph nodes'],['daily',`Daily · ${projection.day}`],['monthly',`Monthly · ${projection.month}`],['quarterly',`Quarterly review · ${projection.quarter}`]],horizon,v=>{horizon=v as typeof horizon;}));
    host.append(filters);
    const gaps=text('details','','cw-dept-gaps'); gaps.append(text('summary','Source and authority limits'));
    for(const status of reader.readerStatus??[]) gaps.append(text('p',status));
    for(const gap of projection.gaps)gaps.append(text('p',gap));
    gaps.append(text('p',`Observed ${projection.observedAt} · head ${projection.headDigest}`));host.append(gaps);
    if(department!=='all') {
      const d=DEPARTMENTS[department],profile=text('section','','cw-dept-profile');
      profile.append(text('h4',d.label),text('p',`Org reference: ${d.roleId} · runtime assignment unverified`),
        text('p',`Skill cluster references: ${d.clusters.join(' → ')}`),text('p',`Binding source: ${d.sourceRef}`));
      if(d.desks.length)profile.append(text('p',`Existing Will desks: ${d.desks.join(', ')}`));
      profile.append(text('p',`Long-term review question: ${LONG_TERM_QUESTIONS[department]}`));
      const definition=KPI_DEFINITIONS.find(k=>k.productId===productId&&k.departmentId===department)!;
      const matches=Array.isArray(reader.observations)?reader.observations.filter(o=>o && typeof o==='object' && o.definitionId===definition.id):[];
      const observation=matches.length===1?matches[0]:null;
      const metric=observeKpi(definition,observation,new Date().toISOString(),projection.month);
      profile.append(text('h4',definition.label),text('p',`${metric.value===null?metric.state:`${(metric.value*100).toFixed(1)}% · n=${metric.sampleSize}`} · target unset`),
        text('p',definition.formula),text('p',`Definition v${definition.version} · ${definition.id} · cohort ${definition.cohort} · window ${projection.month} · freshness ${definition.maxAgeHours}h`),text('p',`${metric.reason}. Reader: ${definition.sourceReader}. Guardrail: ${definition.guardrail}`));
      if(observation)profile.append(text('p',`Observed ${observation.observedAt} · ${observation.numerator}/${observation.denominator} · source ${observation.sourceRef}`));
      if(matches.length>1)profile.append(text('p','Conflicting observations: select a single applicable source revision before reporting a value.'));
      host.append(profile);
    }
    if(horizon==='quarterly') {
      host.append(text('h4','Learning review · candidates, evaluation, owner decision'),text('p','Review unchanged KPI definitions, failed hypotheses, counterevidence and repeated holds. Cortex learning stays a candidate until evaluated and accepted; no memory or skill source is rewritten here.'));
      const departments=department==='all'?Object.keys(DEPARTMENTS) as DepartmentId[]:[department];
      for(const id of departments)host.append(text('p',`${DEPARTMENTS[id].label}: ${LONG_TERM_QUESTIONS[id]}`));
    } else {
      const source=horizon==='daily'?product.daily:horizon==='monthly'?product.monthly:product.nodes;
      const nodes=source.filter(n=>department==='all'||n.binding?.departmentId===department);
      host.append(text('p',`${nodes.length} matching records · ${horizon==='daily'?'selection from supplied GSD eligibility only':horizon==='monthly'?'existing dated commitments; no new milestones':'one record per canonical node'}`));
      if(!nodes.length)host.append(text('p',horizon==='daily'?'No eligible daily work in this source read. A due date or approval metadata does not admit execution.':'No matching records in this source packet.'));
      page=Math.min(page,Math.max(0,Math.ceil(nodes.length/18)-1));
      const list=text('div','','cw-dept-list');
      for(const n of nodes.slice(page*18,(page+1)*18)) {
        const card=text('button','','cw-dept-card');card.type='button';card.setAttribute('aria-label',`Inspect ${n.label} ${n.nodeId}`);
        card.append(text('strong',n.label),text('span',`${n.binding?DEPARTMENTS[n.binding.departmentId].label:'Unbound'} · ${n.binding?.category??'category missing'}`),
          text('span',`${n.status} · ${n.evidenceState}${n.dueAt?` · ${n.dueAt}`:''}`));
        card.onclick=()=>{selectedId=n.nodeId;render();host.querySelector<HTMLElement>('.cw-dept-dossier')?.focus();};list.append(card);
      }
      host.append(list);
      if(nodes.length>18) {
        const nav=text('div','','cw-dept-paging');
        const previous=text('button','Previous','cw-button'),next=text('button','Next','cw-button');previous.type=next.type='button';
        previous.disabled=page===0;next.disabled=(page+1)*18>=nodes.length;
        previous.onclick=()=>{page--;selectedId=null;render();};next.onclick=()=>{page++;selectedId=null;render();};
        nav.append(previous,text('span',`Page ${page+1} of ${Math.ceil(nodes.length/18)}`),next);host.append(nav);
      }
      const n=nodes.find(n=>n.nodeId===selectedId);
      if(n) {
        const dossier=text('section','','cw-dept-dossier');dossier.tabIndex=-1;dossier.setAttribute('aria-label','Selected department node');
        dossier.append(text('h4',n.label));
        for(const [label,value] of Object.entries({Identity:n.nodeId,Parent:n.parentNodeId??'Root',Work:n.workObjectId,Outcome:n.desiredState,Current:n.currentState,Next:n.nextAction??'No next action supplied',Role:n.binding?.roleId??'Unbound',Category:n.binding?.category??'Unbound',Inherited:n.binding?.inheritedFrom??'No binding',Clusters:n.binding?.clusterIds.join(', ')??'Unbound',Spokes:n.binding?.skillRefs.map(s=>`${s.clusterId} → ${s.id} · ${s.digest} · origin ${s.origin}`).join('; ')||'Resolve category spokes on demand',Objectives:n.objectiveRefs.join(', ')||'No ancestor outcome supplied',KPIs:n.kpiIds.join(', ')||'Unbound',Evidence:n.evidenceRef??'Unavailable',Source:n.sourceRef,Gap:n.gap??'Runtime assignment unverified; source binding is provisional'})) {
          dossier.append(text('strong',label),text('p',value));
        }
        const back=text('button','Return to records','cw-button');back.type='button';back.onclick=()=>{selectedId=null;render();host.querySelector<HTMLButtonElement>('.cw-dept-card')?.focus();};
        dossier.append(back);host.append(dossier);
      }
    }
    const taste=text('details','','cw-dept-gaps');taste.append(text('summary','Taste / Cortex reuse'));
    taste.append(text('p',reader.taste?.state==='supplied' && Array.isArray(reader.taste.lineage)?`Scoped supplied lineage: ${reader.taste.lineage.filter(l=>l && typeof l.slug==='string' && typeof l.author==='string').slice(0,8).map(l=>`${l.slug} (${l.author})`).join(', ')}`:'Taste references not supplied for this read; the existing composer is available on demand.'),
      text('p','Existing org roles and Will desks are reused as reference bindings. No new agent, corpus, scheduler, organ or hook is installed.'));host.append(taste);
    if(focusLabel) Array.from(host.querySelectorAll<HTMLElement>('[aria-label]')).find(el=>el.getAttribute('aria-label')===focusLabel)?.focus();
  }
  let unsubscribe:(()=>void)|undefined;
  try { unsubscribe=bridge.subscribeDepartment?.(render); } catch { /* Manual refresh remains available. */ }
  render();
  return ()=>{disposed=true;unsubscribe?.();host.replaceChildren();};
}
