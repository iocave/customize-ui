// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { openSync } from 'fs';

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

function mkdirRecursive(p: string) {
    if (!fs.existsSync(p)) {
        if (path.parse(p).root !== p) {
            let parent = path.join(p, "..");
            mkdirRecursive(parent);
        }
        fs.mkdirSync(p);
    }
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

	get sourcePath() {
		return path.join(this.context.extensionPath, "modules");
	}

	get modulesPath() {
		return path.join(this.context.globalStoragePath, "modules");
	}

	private copyModule(name : string) {
		fs.copyFileSync(path.join(this.sourcePath, name), path.join(this.modulesPath, name));
	}

	async start() {

		mkdirRecursive(this.modulesPath);

		// copy the modules to global storage path, which unlike extension path is not versioned
		// and will work after update
		this.copyModule("customize-ui.css");
		this.copyModule("customize-ui.js");

		let monkeyPatch = vscode.extensions.getExtension("iocave.monkey-patch");

		if (monkeyPatch !== undefined) {
			await monkeyPatch.activate();
			let exports: API = monkeyPatch.exports;
			exports.contribute("iocave.customize-ui",
				{
					folderMap: {
						"customize-ui": this.modulesPath,
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
			} else {
				let res = await vscode.window.showInformationMessage("Customizing UI requires window reload", "Reload Window");
				if (res === "Reload Window") {
					vscode.commands.executeCommand("workbench.action.reloadWindow");
				}
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
