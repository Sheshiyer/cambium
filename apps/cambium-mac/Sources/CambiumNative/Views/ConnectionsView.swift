import SwiftUI

struct ConnectionsView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        PageScaffold(eyebrow: "Account", title: "Connections", subtitle: "Your account and connected sources.") {
            TimelineView(.periodic(from: .now, by: 15)) { context in
                VStack(alignment: .leading, spacing: 16) {
                    HStack(spacing: 12) {
                        Image(systemName: "person.crop.circle").font(.system(size: 32)).foregroundStyle(Palette.signal)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(model.isDemo ? "Demo workspace" : "Cambium account").font(CambiumFont.heading)
                            Text(model.isDemo ? "Explore with sample data." : model.hasCurrentSession(at: context.date) ? "You're connected." : model.session == nil ? "Sign in to see your projects and work." : "Your session has expired.")
                                .font(.callout).foregroundStyle(Palette.inkMuted)
                        }
                        Spacer()
                    }
                    if model.isDemo {
                        Button("Leave demo", action: model.leaveDemo)
                    } else if let session = model.session, model.hasCurrentSession(at: context.date) {
                        FactRow(label: "Workspace", value: session.tenantId.replacingOccurrences(of: "-", with: " ").capitalized)
                        FactRow(label: "Session ends", value: model.time(session.expiresAt))
                        Button("Sign out", action: model.signOut)
                    } else {
                        Button(model.session == nil ? "Sign in" : "Sign in again", action: model.beginSignIn)
                            .buttonStyle(.borderedProminent).disabled(model.loading)
                    }
                }.cambiumPanel()
            }
            if !model.snapshot.connections.isEmpty {
                VStack(alignment: .leading, spacing: 14) {
                    SectionHeader(title: "Connected sources")
                    ForEach(model.snapshot.connections) { connection in
                        HStack {
                            Text(connection.name).font(.callout)
                            Spacer()
                            StatusChip(text: connection.status.replacingOccurrences(of: "-", with: " ").capitalized, tone: Tone.forStatus(connection.status))
                        }
                    }
                }.cambiumPanel()
            }
        }
    }
}
