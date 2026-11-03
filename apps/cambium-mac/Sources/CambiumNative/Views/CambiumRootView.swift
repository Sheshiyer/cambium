import AppKit
import SwiftUI

/// Root of the main window: sidebar navigation, search, and the selected page.
struct CambiumRootView: View {
    @State private var model = AppModel()
    @State private var columns: NavigationSplitViewVisibility = .all
    @FocusState private var searchFocused: Bool
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion

    var body: some View {
        @Bindable var model = model
        NavigationSplitView(columnVisibility: $columns) {
            SidebarView()
                .navigationSplitViewColumnWidth(min: 200, ideal: 230, max: 300)
        } detail: {
            VStack(spacing: 0) {
                ModeStrip()
                DetailAreaView()
                StatusLine()
            }
            .background(Palette.canvas)
        }
        .searchable(text: $model.query, placement: .sidebar, prompt: "Search")
        .searchFocused($searchFocused)
        .toolbar {
            ToolbarItem(placement: .navigation) {
                GoMenu(focusSearch: focusSearch)
            }
        }
        // Scene-scoped so the Go menu in App.commands targets this window's model,
        // whichever control inside the window has keyboard focus.
        .focusedSceneValue(\.cambiumModel, model)
        .focusedSceneValue(\.cambiumFocusSearch, SearchFocusAction(focusSearch))
        // The title of the window hosting this view follows its actual data mode.
        .background(WindowTitleSetter(title: model.mode.windowTitle))
        .onAppear { applyRequestedScreen() }
        .onReceive(NotificationCenter.default.publisher(for: SnapshotRun.appearanceDidChange)) { note in
            guard model.isDemo, let raw = note.object as? String,
                  let choice = AppearanceChoice(rawValue: raw) else { return }
            model.appearance = choice
        }
        .environment(model)
        .environment(\.cambiumReduceMotion, systemReduceMotion || model.reduceMotion)
        .preferredColorScheme(model.appearance.colorScheme)
        .tint(Palette.signal)
    }

    private func focusSearch() {
        columns = .all
        searchFocused = true
    }

    /// Snapshot support: CAMBIUM_NATIVE_SCREEN=<AppSection.rawValue> picks the page, in demo
    /// mode only. Only a recognized section is opened; no action is invoked.
    private func applyRequestedScreen() {
        guard model.isDemo, let section = SnapshotRun.requestedSection else { return }
        model.open(section)
        SnapshotRun.appliedSection = section
    }
}

/// Sets the title of the window that hosts this view. The WindowGroup title is static
/// (LaunchMode.current), so it cannot follow a per-window Open demo or Leave demo.
private struct WindowTitleSetter: NSViewRepresentable {
    let title: String

    func makeNSView(context: Context) -> TitleView { TitleView() }

    func updateNSView(_ view: TitleView, context: Context) {
        view.title = title
        view.window?.title = title
    }

    final class TitleView: NSView {
        var title = ""
        override func viewDidMoveToWindow() {
            super.viewDidMoveToWindow()
            if !title.isEmpty { window?.title = title }
        }
    }
}

/// Toolbar entry point for the same pages. Keyboard shortcuts live in the app's Go menu
/// (CambiumNavigationCommands); registering them here too would duplicate them.
private struct GoMenu: View {
    @Environment(AppModel.self) private var model
    let focusSearch: () -> Void

    var body: some View {
        Menu {
            ForEach(AppSection.allCases) { section in
                Button {
                    model.open(section)
                } label: {
                    Label(section.title, systemImage: section.symbol)
                }
            }
            Divider()
            Button("Find", action: focusSearch)
        } label: {
            Label("Go to", systemImage: "list.bullet")
        }
        .help("Go to a page (Command-1 to Command-9, Command-0 for Projects) or search (Command-F)")
        .accessibilityLabel("Go to page")
    }
}

private struct SidebarView: View {
    @Environment(AppModel.self) private var model

    private let groups: [(String, [AppSection])] = [
        ("Overview", [.canopy, .projects, .inbox, .work, .trace, .evidence]),
        ("Decide and run", [.proposal, .launch]),
        ("Sources", [.knowledge, .connections]),
        ("App", [.preferences])
    ]

    var body: some View {
        @Bindable var model = model
        List(selection: Binding<AppSection?>(
            get: { model.section },
            set: { if let value = $0 { model.open(value) } })) {
            ForEach(groups, id: \.0) { group in
                Section(group.0) {
                    ForEach(group.1) { section in
                        Label(section.title, systemImage: section.symbol)
                            .tag(section)
                            .accessibilityLabel(section.title)
                    }
                }
            }
        }
        .listStyle(.sidebar)
        .navigationTitle("Cambium")
        .safeAreaInset(edge: .bottom) {
            SidebarFooter()
        }
    }
}

private struct SidebarFooter: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        TimelineView(.periodic(from: .now, by: 15)) { context in
            VStack(alignment: .leading, spacing: 6) {
                if model.isDemo {
                    SyntheticBadge()
                    Button("Leave demo") { model.leaveDemo() }
                        .controlSize(.small)
                        .accessibilityHint("Returns to standard mode with no data")
                } else if model.hasCurrentSession(at: context.date) {
                    StatusChip(text: "Connected", tone: .signal)
                    Button("Account") { model.open(.connections) }.controlSize(.small)
                } else {
                    if model.session != nil { Text("Session expired").font(.caption).foregroundStyle(Palette.hold) }
                    Button(model.session == nil ? "Sign in" : "Sign in again", action: model.beginSignIn)
                        .controlSize(.small).disabled(model.loading)
                    Button("Open demo") { model.enterDemo() }
                        .controlSize(.small)
                        .accessibilityHint("Shows labelled synthetic data. Nothing is live.")
                }
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

/// Always-visible statement of where the data comes from.
private struct ModeStrip: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        if model.isDemo {
            HStack(spacing: 10) {
                SyntheticBadge(compact: true)
                Text("Sample data").font(.callout).foregroundStyle(Palette.inkMuted)
                Spacer()
                Button("Leave demo", action: model.leaveDemo).controlSize(.small)
            }
            .padding(.horizontal, 20).padding(.vertical, 8)
            .background(Palette.holdFill)
            .overlay(alignment: .bottom) { Divider() }
        }
    }
}

/// Feedback for the last local action.
private struct StatusLine: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        if let feedback = model.feedback {
            HStack(spacing: 8) {
                Image(systemName: "checkmark.circle")
                    .foregroundStyle(Palette.evidence)
                    .accessibilityHidden(true)
                Text(feedback)
                    .font(.callout)
                    .foregroundStyle(Palette.ink)
                    .lineLimit(2)
                Spacer(minLength: 8)
                Button("Dismiss") { model.clearFeedback() }
                    .buttonStyle(.borderless)
                    .controlSize(.small)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 8)
            .background(Palette.surface)
            .overlay(alignment: .top) { Divider() }
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.updatesFrequently)
        }
    }
}

private struct DetailAreaView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        Group {
            if !model.query.trimmingCharacters(in: .whitespaces).isEmpty {
                SearchResultsView()
            } else {
                switch model.section {
                case .canopy: CanopyView()
                case .projects: ProjectsView()
                case .inbox: InboxView()
                case .work: WorkDossierView()
                case .trace: TraceView()
                case .evidence: EvidenceView()
                case .proposal: ProposalView()
                case .launch: LaunchView()
                case .knowledge: KnowledgeView()
                case .connections: ConnectionsView()
                case .preferences: PreferencesView()
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

private struct SearchResultsView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let hits = model.searchHits
        PageScaffold(eyebrow: "Search", title: "Results for “\(model.query)”",
                     subtitle: hits.isEmpty ? "Nothing matched." : "\(hits.count) matches. Choose one to open it.") {
            if hits.isEmpty {
                EmptyStateView(symbol: "magnifyingglass", title: "No matches",
                               message: model.isDemo
                                   ? "Try a work name, a mapped project, an evidence title or a page name."
                                   : "Only page names are searchable until you open the demo or sign-in exists.")
            } else {
                VStack(spacing: 8) {
                    ForEach(hits) { hit in
                        Button(action: hit.apply) {
                            HStack(spacing: 12) {
                                Image(systemName: hit.section.symbol)
                                    .foregroundStyle(Palette.rail)
                                    .frame(width: 24)
                                    .accessibilityHidden(true)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(hit.title).font(CambiumFont.heading).foregroundStyle(Palette.ink)
                                    Text(hit.detail).font(.callout).foregroundStyle(Palette.inkMuted).lineLimit(2)
                                }
                                Spacer(minLength: 8)
                                Text(hit.section.title).font(CambiumFont.label).foregroundStyle(Palette.rail)
                            }
                            .contentShape(Rectangle())
                            .cambiumPanel(padding: 12)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("\(hit.title), \(hit.section.title)")
                        .accessibilityHint("Opens it")
                    }
                }
            }
        }
    }
}
