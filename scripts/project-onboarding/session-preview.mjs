import { readFile } from 'node:fs/promises'

const path = process.argv[2]
if (!path) throw new Error('Pass a reviewed onboarding packet path.')
const packet = JSON.parse(await readFile(path, 'utf8'))
if (packet.schema !== 'cambium.project-onboarding.v1') throw new Error('Expected an onboarding packet.')
const { identity, primary } = packet.evidence
console.log(`# ${identity.name} · Chat workflow dry run\n`)
console.log(`Governor proposal for \`${identity.workId}\` · input \`${packet.inputDigest}\`\n`)
console.log(`Planning repository: ${primary?.repository ?? 'unbound'}. Roadmap: ${packet.roadmap}.\n`)
if (packet.notices.length) console.log(packet.notices.join('\n') + '\n')

const phases = new Map()
for (const goal of packet.goals) {
  const phase = goal.stage.split(' · ')[0]
  if (!phases.has(phase)) phases.set(phase, [])
  phases.get(phase).push(goal)
}
console.log('## Proposed phase and wave chats\n')
console.log('Grouped by draft roadmap stage. Reconcile with GSD and the current handoff before selecting an active phase.\n')
for (const [phase, goals] of phases) {
  console.log(`### ${identity.name} · ${phase}\n`)
  for (const goal of goals) {
    console.log(`- ${identity.name} · ${phase} · ${goal.id} · ${goal.rail} · ${goal.state}. ${goal.outcome}`)
    if (goal.dependsOn.length) console.log(`  - Prerequisites: ${goal.dependsOn.join(', ')}.`)
  }
  console.log()
}
if (!phases.size) console.log('Phase mapping needs a reviewed roadmap or a reconciled local GSD source.\n')
console.log('## Standing review preview\n')
const next = packet.goals.find(goal => goal.state === 'needs-decision')
console.log(next ? `Next owner decision for review: ${next.outcome}` : 'Next decision: reconcile roadmap, phase and planning authority.')
console.log('\n## Archive review\n')
if (!packet.children.length) console.log('No child receipts supplied.')
for (const child of packet.children) console.log(`- ${child.key} · ${child.rail} · ${child.disposition}`)
