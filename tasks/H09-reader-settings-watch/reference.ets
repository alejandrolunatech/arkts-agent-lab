class SizePreset {
  label: string;
  size: number;

  constructor(label: string, size: number) {
    this.label = label;
    this.size = size;
  }
}

const PRESETS: SizePreset[] = [
  new SizePreset('Small', 14),
  new SizePreset('Medium', 18),
  new SizePreset('Large', 24),
];

const MIN_SIZE: number = 14;
const MAX_SIZE: number = 30;
const SIZE_STEP: number = 2;

@Component
struct SizeControls {
  @StorageLink('readerTextSize') textSize: number = 18;

  build() {
    Column({ space: 12 }) {
      Row({ space: 16 }) {
        Button('A-')
          .onClick(() => {
            this.textSize = Math.max(MIN_SIZE, this.textSize - SIZE_STEP);
          })
        Text(`${this.textSize}`)
          .fontSize(20)
        Button('A+')
          .onClick(() => {
            this.textSize = Math.min(MAX_SIZE, this.textSize + SIZE_STEP);
          })
      }
      Row({ space: 8 }) {
        ForEach(PRESETS, (preset: SizePreset) => {
          Button(preset.label)
            .onClick(() => {
              this.textSize = preset.size;
            })
        }, (preset: SizePreset) => preset.label)
      }
    }
  }
}

@Component
struct PreviewSentence {
  @StorageProp('readerTextSize') textSize: number = 18;
  @StorageProp('readerBold') bold: boolean = false;

  build() {
    Text('The quick brown fox')
      .fontSize(this.textSize)
      .animation({ duration: 300, curve: Curve.EaseInOut })
      .fontWeight(this.bold ? FontWeight.Bold : FontWeight.Normal)
  }
}

@Component
struct ChangeCounter {
  @StorageProp('readerTextSize') @Watch('onTextSizeChanged') textSize: number = 18;
  @State changes: number = 0;

  onTextSizeChanged(): void {
    this.changes += 1;
  }

  build() {
    Text(`Changed ${this.changes} times`)
      .fontSize(16)
  }
}

@Entry
@Component
struct ReaderSettingsPage {
  @StorageLink('readerBold') bold: boolean = false;

  build() {
    Column({ space: 20 }) {
      Row({ space: 12 }) {
        Text('Bold')
        Toggle({ type: ToggleType.Switch, isOn: this.bold })
          .onChange((isOn: boolean) => {
            this.bold = isOn;
          })
      }
      SizeControls()
      PreviewSentence()
      ChangeCounter()
    }
    .width('100%')
    .height('100%')
    .padding(16)
  }
}
