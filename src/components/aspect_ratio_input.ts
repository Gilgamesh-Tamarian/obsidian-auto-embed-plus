import { DropdownComponent, TextComponent } from "obsidian";
import { AspectRatioType } from "src/types/aspect-ratio";
import { isValidAspectRatio } from "src/utils/ratio.utils";

type RatioDropdownValue = AspectRatioType | "custom";

export function createAspectRatioInput(
	iframeRatioContainer: HTMLElement,
	onAspectRatioUpdate: (aspectRatio: AspectRatioType) => void,
	initialValue: AspectRatioType = "auto",
): HTMLDivElement {
	const aspectRatioInputContainer = iframeRatioContainer.createEl("div");
	const heightInputName = "heightValue";
	aspectRatioInputContainer.className = "space-y";

	const heightInputLabel = aspectRatioInputContainer.createEl("label");
	heightInputLabel.setAttribute("for", heightInputName);
	heightInputLabel.innerText = "Aspect Ratio: ";

	const ratioInput = new DropdownComponent(aspectRatioInputContainer);
	ratioInput.addOptions({
		"auto": "Auto (site default)",
		"16/9": "16/9",
		"4/3": "4/3",
		"1/1": "1/1",
		"9/16": "9/16",
		"3/2": "3/2",
		"21/9": "21/9",
		"none": "none",
		"custom": "Custom...",
	});

	const customInput = new TextComponent(aspectRatioInputContainer);
	customInput
		.setPlaceholder("Custom ratio, e.g. 5/4")
		.setValue("");

	const validationMessage = aspectRatioInputContainer.createEl("small", {
		text: "",
	});
	validationMessage.style.display = "block";
	validationMessage.style.marginTop = "4px";

	ratioInput.setValue(initialValue);
	onAspectRatioUpdate(initialValue);

	ratioInput.onChange((value: RatioDropdownValue) => {
		if (value === "custom") {
			customInput.inputEl.focus();
			return;
		}

		validationMessage.setText("");
		onAspectRatioUpdate(value);
	});

	customInput.onChange((value: string) => {
		const normalized = value.trim();
		if (!normalized) {
			validationMessage.setText("");
			return;
		}

		if (!isValidAspectRatio(normalized)) {
			validationMessage.setText("Use format width/height with positive numbers, e.g. 5/4");
			return;
		}

		validationMessage.setText("");
		ratioInput.setValue("custom");
		onAspectRatioUpdate(normalized as `${number}/${number}`);
	});

	return aspectRatioInputContainer;
}
