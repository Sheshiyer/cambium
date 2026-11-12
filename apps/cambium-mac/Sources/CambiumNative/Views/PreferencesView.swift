import SwiftUI

struct PreferencesView: View {
    @Environment(AppModel.self) private var model
    @State private var diagnosticsPresented = false

    var body: some View {
        @Bindable var model = model
        PageScaffold(eyebrow: "App", title: "Settings",
                     subtitle: "Make Cambium comfortable to use.") {
            VStack(alignment: .leading, spacing: 14) {
                SectionHeader(title: "Appearance & Motion")
                Picker("Appearance", selection: $model.appearance) {
                    ForEach(AppearanceChoice.allCases) { choice in
                        Text(choice.title).tag(choice)
                    }
                }
                .pickerStyle(.segmented)
                .frame(maxWidth: 300)

                Toggle("Reduce motion", isOn: $model.reduceMotion)
                    .onChange(of: model.reduceMotion) { _, _ in model.persistVisualPreferences() }
                Toggle("Display times in UTC", isOn: $model.utcTimes)
                    .onChange(of: model.utcTimes) { _, _ in model.persistVisualPreferences() }
            }
            .onChange(of: model.appearance) { _, _ in model.persistVisualPreferences() }
            .cambiumPanel()

            VStack(alignment: .leading, spacing: 10) {
                SectionHeader(title: "Explore")
                Text("Try Cambium with sample data.").font(.callout).foregroundStyle(Palette.inkMuted)
                HStack {
                    if model.isDemo {
                        Button("Leave demo", action: model.leaveDemo)
                    } else {
                        Button("Open demo", action: model.enterDemo)
                    }
                    Spacer()
                }
            }
            .cambiumPanel()

            VStack(alignment: .leading, spacing: 10) {
                SectionHeader(title: "Advanced")
                Button("Open diagnostics", systemImage: "wrench.and.screwdriver") { diagnosticsPresented = true }
                Text("Connection settings and technical details.").font(.caption).foregroundStyle(Palette.inkMuted)
            }.cambiumPanel()
        }
        .sheet(isPresented: $diagnosticsPresented) { DiagnosticsView().environment(model) }
    }
}
