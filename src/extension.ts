// Copyright (c) TASKING
// Contains work covered by the following terms:
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import TelemetryReporter from "@vscode/extension-telemetry";
import * as vscode from "vscode";
import { ExtensionHostMessageHandler, MessageType } from "../shared/protocol";
import { DataInspectorView } from "./dataInspectorView";
import { showGoToOffset } from "./goToOffset";
import { HexEditorProvider } from "./hexEditorProvider";
import { HexEditorRegistry } from "./hexEditorRegistry";
import StatusSelectionCount from "./statusSelectionCount";

function readConfigFromPackageJson(extension: vscode.Extension<any>): { extId: string; version: string; aiKey: string } {
    const packageJSON = extension.packageJSON;
    return {
        extId: `${packageJSON.publisher}.${packageJSON.name}`,
        version: packageJSON.version,
        aiKey: packageJSON.aiKey
    };
}

function reopenWithHexEditor() {
    const activeTabInput = vscode.window.tabGroups.activeTabGroup.activeTab?.input as { [key: string]: any, uri: vscode.Uri | undefined };
    if (activeTabInput.uri) {
        vscode.commands.executeCommand("vscode.openWith", activeTabInput.uri, "TASKING-hexEditor.hexedit");
    }
}

async function openDebugMemory(memoryRef: number, sessionId: string, registry: HexEditorRegistry) {

    //close any other memory views, only one must be visible at all times
    vscode.window.tabGroups.all.forEach(sourceGroup => {
        sourceGroup.tabs.forEach(async tab => {
            if (tab.input instanceof vscode.TabInputCustom && tab.input.viewType === "TASKING-hexEditor.hexedit") {
                await vscode.window.tabGroups.close(tab, true);
            }
        });
    });

    //open memory view with a command
    const uri = vscode.Uri.parse("vscode-debug-memory://" + sessionId + "/" + "0x0" + "/memory.bin?baseAddress=" + memoryRef);

    await vscode.commands.executeCommand("vscode.openWith", uri, "TASKING-hexEditor.hexedit");
    await vscode.commands.executeCommand("workbench.action.moveEditorToNextGroup");

    //wait a bit for init, then select the opened address
    setTimeout(() => {
        const first = registry.activeMessaging[Symbol.iterator]().next();
        if (first.value) {
            const messaging: ExtensionHostMessageHandler = first.value;
            messaging.sendEvent({ type: MessageType.SetFocusedByte, offset: memoryRef });
        }
    }, 500);

}

export function activate(context: vscode.ExtensionContext): void {
    const registry = new HexEditorRegistry();
    // Register the data inspector as a separate view on the side
    const dataInspectorProvider = new DataInspectorView(context.extensionUri, registry);
    const configValues = readConfigFromPackageJson(context.extension);
    context.subscriptions.push(
        registry,
        dataInspectorProvider,
        vscode.window.registerWebviewViewProvider(DataInspectorView.viewType, dataInspectorProvider)
    );

    const telemetryReporter = new TelemetryReporter(configValues.extId, configValues.version, configValues.aiKey);
    context.subscriptions.push(telemetryReporter);
    const openWithCommand = vscode.commands.registerCommand("TASKING-hexEditor.openFile", reopenWithHexEditor);
    const openDebugCommand = vscode.commands.registerCommand("TASKING-hexEditor.openDebugMemory", async (memoryRef) => {
        const session = vscode.debug.activeDebugSession;
        if (session === undefined) {
            return;
        }
        if (memoryRef === undefined) {
            memoryRef = 0;
        }

        openDebugMemory(memoryRef, session.id, registry);
    });
    const goToOffsetCommand = vscode.commands.registerCommand("TASKING-hexEditor.goToOffset", () => {
        const first = registry.activeMessaging[Symbol.iterator]().next();
        if (first.value && registry.activeDocument) {
            showGoToOffset(first.value, registry.activeDocument?.baseAddress);
        }
    });
    const refreshCommand = vscode.commands.registerCommand("TASKING-hexEditor.refresh", () => {
        const first = registry.activeMessaging[Symbol.iterator]().next();
        if (first.value) {
            const messaging: ExtensionHostMessageHandler = first.value;
            messaging.sendEvent({ type: MessageType.ReloadFromDisk });
        }
    });
    context.subscriptions.push(new StatusSelectionCount(registry));
    context.subscriptions.push(goToOffsetCommand);
    context.subscriptions.push(openWithCommand);
    context.subscriptions.push(refreshCommand);
    context.subscriptions.push(openDebugCommand);
    context.subscriptions.push(telemetryReporter);
    context.subscriptions.push(HexEditorProvider.register(context, telemetryReporter, dataInspectorProvider, registry));

}

export function deactivate(): void { /* no-op */ }
