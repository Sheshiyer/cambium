import assert from 'node:assert/strict'
import test from 'node:test'

type DrawerTabsClassName = (tabCount: number) => string

async function loadDrawerTabsClassName(): Promise<DrawerTabsClassName> {
  try {
    const module = await import('./drawer-tabs.ts')
    return module.drawerTabsClassName
  } catch {
    return (tabCount) => (tabCount === 5 ? 'drawer-tabs has-operate' : 'drawer-tabs')
  }
}

test('drawerTabsClassName returns exact classes for five and six drawer tabs', async () => {
  const drawerTabsClassName = await loadDrawerTabsClassName()

  assert.equal(drawerTabsClassName(5), 'drawer-tabs')
  assert.equal(drawerTabsClassName(6), 'drawer-tabs has-operate')
})
