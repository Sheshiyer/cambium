import SwiftUI

/// Wrapper so the focus action is a comparable reference, not a bare closure.
final class SearchFocusAction: Equatable {
    let run: () -> Void
    init(_ run: @escaping () -> Void) { self.run = run }
    static func == (lhs: SearchFocusAction, rhs: SearchFocusAction) -> Bool { lhs === rhs }
}

extension FocusedValues {
    /// Model of the focused main window. Set by the root view of each window scene.
    @Entry var cambiumModel: AppModel?
    /// Moves keyboard focus to the focused window's search field.
    @Entry var cambiumFocusSearch: SearchFocusAction?
}

/// The Go menu: Command-1 to Command-9 and Command-0 (Projects) open pages, Command-F focuses search.
struct CambiumNavigationCommands: Commands {
    @FocusedValue(\.cambiumModel) private var model
    @FocusedValue(\.cambiumFocusSearch) private var focusSearch

    var body: some Commands {
        CommandMenu("Go") {
            ForEach(AppSection.allCases.filter { $0 != .inbox }) { section in
                Button(section.title) { model?.open(section) }
                    .keyboardShortcut(section.shortcut, modifiers: .command)
                    .disabled(model == nil)
            }
            Button("Inbox") { model?.open(.inbox) }.disabled(model == nil)
            Divider()
            Button("Find") { focusSearch?.run() }
                .keyboardShortcut("f", modifiers: .command)
                .disabled(focusSearch == nil)
        }
    }
}
