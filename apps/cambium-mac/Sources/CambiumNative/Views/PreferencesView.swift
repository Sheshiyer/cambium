import SwiftUI

struct PreferencesView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        PageScaffold(eyebrow: "Preferences", title: "Preferences",
                     subtitle: "Appearance and motion settings stored in local application state.") {
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
                Toggle("Display times in UTC", isOn: $model.utcTimes)
            }
            .cambiumPanel()

            VStack(alignment: .leading, spacing: 10) {
                SectionHeader(title: "Environment")
                FactRow(label: "Mode", value: model.isDemo ? "Synthetic demo" : "Standard")
                FactRow(label: "Summary", value: model.mode.summary)
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
        }
    }
}
