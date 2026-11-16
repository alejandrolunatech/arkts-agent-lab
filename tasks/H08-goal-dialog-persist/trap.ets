class GoalPreset {
  label: string = '';
  glasses: number = 0;
}

const PRESETS: GoalPreset[] = [
  { label: 'Light', glasses: 6 },
  { label: 'Standard', glasses: 8 },
  { label: 'Active', glasses: 12 },
];

interface WaterState {
  count: number;
  goal: number;
}

const STORAGE_KEY = 'water';
const DEFAULT_STATE: WaterState = { count: 0, goal: 8 };

PersistentStorage.persistProp(STORAGE_KEY, JSON.stringify(DEFAULT_STATE));

function loadState(): WaterState {
  const saved = JSON.parse(AppStorage.get<string>(STORAGE_KEY) ?? '{}');
  return { ...DEFAULT_STATE, ...saved };
}

function saveState(state: WaterState): void {
  AppStorage.set(STORAGE_KEY, JSON.stringify(state));
}

@CustomDialog
struct GoalDialog {
  controller: CustomDialogController;
  onSave: (goal: number) => void;
  @State text: string = '';

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
              this.text = String(preset.glasses);
            })
        }, (preset: GoalPreset) => preset.label)
      }
      Row({ space: 12 }) {
        Button('Cancel')
          .onClick(() => this.controller.dismiss())
        Button('Save')
          .onClick(() => {
            const goal = +this.text;
            if (Number.isInteger(goal) && goal >= 1) {
              this.onSave(goal);
              this.controller.dismiss();
            }
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
  @State water: WaterState = loadState();
  private dialog = new CustomDialogController({
    builder: GoalDialog({
      onSave: (goal: number) => this.update({ goal }),
    }),
  });

  update(changes: Partial<WaterState>): void {
    this.water = { ...this.water, ...changes };
    saveState(this.water);
  }

  build() {
    Column({ space: 16 }) {
      ProgressSummary({ count: this.water.count, goal: this.water.goal })
      Button('Add a glass')
        .onClick(() => this.update({ count: this.water.count + 1 }))
      Button('Change goal')
        .onClick(() => this.dialog.show())
    }
    .width('100%')
    .height('100%')
    .padding(16)
  }
}
