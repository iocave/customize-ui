// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';

interface FolderMap { [key: string]: string; }

interface Contribution {
	folderMap: FolderMap;
	browserModules: Array<string>;
	mainProcessModules: Array<string>;
}

interface API {
	contribute(sourceExtensionId: string, contribution: Contribution): void;
	active(): boolean;
}

class Extension {

	constructor(context: vscode.ExtensionContext) {
		this.context = context;

		context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('customizeUI.')) {
				this.configurationChanged();
			}
		}));
	}

	get dataPath() {
		return path.join(this.context.extensionPath, "data");
	}

	async start() {
		let monkeyPatch = vscode.extensions.getExtension("iocave.monkey-patch");

		if (monkeyPatch !== undefined) {
			await monkeyPatch.activate();
			let exports: API = monkeyPatch.exports;
			exports.contribute("iocave.customize-ui",
				{
					folderMap: {
						"customize-ui": this.dataPath,
					},
					browserModules: [
						"customize-ui/customize-ui"
					],
					mainProcessModules: [
					]
				}
			);
		} else {
			vscode.window.showWarningMessage("Monkey Patch extension is not installed. CustomizeUI will not work.");
		}
	}

	async configurationChanged() {
		let monkeyPatch = vscode.extensions.getExtension("iocave.monkey-patch");
		if (monkeyPatch !== undefined) {
			await monkeyPatch.activate();
			let exports: API = monkeyPatch.exports;
			if (!exports.active()) {
				let res = await vscode.window.showWarningMessage("Monkey Patch extension is not enabled. Please enable Monkey Patch in order to use Customize UI.", "Enable");
				if (res === "Enable") {
					vscode.commands.executeCommand("iocave.monkey-patch.enable");
				}
			}
			let res = await vscode.window.showInformationMessage("Customizing UI requires window reload", "Reload Window");
			if (res === "Reload Window") {
				vscode.commands.executeCommand("workbench.action.reloadWindow");
			}
		}
	}

	context: vscode.ExtensionContext;
}


export function activate(context: vscode.ExtensionContext) {
	new Extension(context).start();
}

// this method is called when your extension is deactivated
export function deactivate() { }
