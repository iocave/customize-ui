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
				this.configurationChanged(e);
			}
		}));
	}

	get sourcePath() {
		return path.join(this.context.extensionPath, "modules");
	}

	get modulesPath() {
		return path.join(this.context.globalStoragePath, "modules");
	}

	private copyModule(name: string) {
		fs.copyFileSync(path.join(this.sourcePath, name), path.join(this.modulesPath, name));
	}

	async start() {

		mkdirRecursive(this.modulesPath);

		// copy the modules to global storage path, which unlike extension path is not versioned
		// and will work after update
		this.copyModule("modules/customize-ui.css");
		this.copyModule("modules/activity-bar.js");
		this.copyModule("modules/customize-ui.js");
		this.copyModule("modules/fonts.js");
		this.copyModule("modules/swizzle.dylib");
		this.copyModule("modules/title-bar-main-process.js");
		this.copyModule("modules/title-bar.js");
		this.copyModule("modules/utils.js");

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
						"customize-ui/title-bar-main-process",
					]
				}
			);
		} else {
			vscode.window.showWarningMessage("Monkey Patch extension is not installed. CustomizeUI will not work.");
		}
	}

	async checkExperimentalLayout() {
		if (vscode.workspace.getConfiguration().get("workbench.useExperimentalGridLayout") !== true) {
			let res = await vscode.window.showWarningMessage("This option needs the 'useExperimentalGridLayout' option enabled", "Enable");
			if (res === "Enable") {
				await vscode.workspace.getConfiguration().update(
					"workbench.useExperimentalGridLayout", true, vscode.ConfigurationTarget.Global,
				);
				return true;
			}
		}
		return false;
	}

	private async promptRestart() {
		// This is a hacky way to display the restart prompt
		let v = vscode.workspace.getConfiguration().inspect("window.titleBarStyle");
		if (v !== undefined) {
			let value = vscode.workspace.getConfiguration().get("window.titleBarStyle");
			await vscode.workspace.getConfiguration().update("window.titleBarStyle", value === "native" ? "custom" : "native", vscode.ConfigurationTarget.Global);
			vscode.workspace.getConfiguration().update("window.titleBarStyle", v.globalValue, vscode.ConfigurationTarget.Global);
		}
	}

	async configurationChanged(e: vscode.ConfigurationChangeEvent) {
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
				if (e.affectsConfiguration("customizeUI.activityBar") &&
					vscode.workspace.getConfiguration().get("customizeUI.activityBar") === "bottom") {
					let res = await this.checkExperimentalLayout();
					if (res) {
						return;
					}
				}
				if (e.affectsConfiguration("customizeUI.titleBar")) {
					let enabled = vscode.workspace.getConfiguration().get("customizeUI.titleBar") === "inline";
					if (enabled) {
						let res = await (this.checkExperimentalLayout());
						if (res) {
							return;
						}
						let titleBarStyle = vscode.workspace.getConfiguration().get("window.titleBarStyle");
						if (titleBarStyle === "custom") {
							let res = await vscode.window.showWarningMessage("Inline title bar requires titleBarStyle = 'native'.", "Enable");
							if (res === "Enable") {
								await vscode.workspace.getConfiguration().update(
									"window.titleBarStyle", "native", vscode.ConfigurationTarget.Global,
								);
								return;
							}
						}
					}
					this.promptRestart();
				}
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
