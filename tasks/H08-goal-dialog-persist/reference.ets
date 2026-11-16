class GoalPreset {
  label: string;
  glasses: number;

  constructor(label: string, glasses: number) {
    this.label = label;
    this.glasses = glasses;
  }
}

const PRESETS: GoalPreset[] = [
  new GoalPreset('Light', 6),
  new GoalPreset('Standard', 8),
  new GoalPreset('Active', 12),
];

PersistentStorage.persistProp<number>('glassCount', 0);
PersistentStorage.persistProp<number>('glassGoal', 8);

@CustomDialog
struct GoalDialog {
  controller?: CustomDialogController;
  onSave: (goal: number) => void = () => {};
  @State text: string = '';

  save(): void {
    const goal = Number(this.text);
    if (this.text.length > 0 && Number.isInteger(goal) && goal >= 1) {
      this.onSave(goal);
      this.controller?.close();
    }
  }

  build() {
    Column({ space: 12 }) {
      Text('Daily goal')
        .fontSize(20)
        .fontWeight(FontWeight.Bold)
      TextInput({ placeholder: 'Glasses per day', text: this.text })
        .type(InputType.Number)
        .onChange((value: string) => {
          this.text = value;
        })
      Row({ space: 8 }) {
        ForEach(PRESETS, (preset: GoalPreset) => {
          Button(preset.label)
            .onClick(() => {
              this.text = `${preset.glasses}`;
            })
        }, (preset: GoalPreset) => preset.label)
      }
      Row({ space: 12 }) {
        Button('Cancel')
          .onClick(() => {
            this.controller?.close();
          })
        Button('Save')
          .onClick(() => {
            this.save();
          })
      }
    }
    .width('100%')
    .padding(16)
  }
}

@Component
struct ProgressSummary {
  @Prop count: number = 0;
  @Prop goal: number = 1;

  build() {
    Column({ space: 8 }) {
      Text(`${this.count} of ${this.goal} glasses`)
        .fontSize(24)
      if (this.count >= this.goal) {
        Text('Goal reached')
          .fontSize(16)
      }
    }
  }
}

@Entry
@Component
struct WaterPage {
  @StorageLink('glassCount') count: number = 0;
  @StorageLink('glassGoal') goal: number = 8;
  private dialog: CustomDialogController = new CustomDialogController({
    builder: GoalDialog({
      onSave: (goal: number): void => {
        this.goal = goal;
      }
    })
  });

  build() {
    Column({ space: 16 }) {
      ProgressSummary({ count: this.count, goal: this.goal })
      Button('Add a glass')
        .onClick(() => {
          this.count += 1;
        })
      Button('Change goal')
        .onClick(() => {
          this.dialog.open();
        })
    }
    .width('100%')
    .height('100%')
    .padding(16)
  }
}
