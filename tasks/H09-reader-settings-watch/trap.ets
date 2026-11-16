interface ReaderSettings {
  size: number;
  bold: boolean;
}

type Listener<K extends keyof ReaderSettings> = (value: ReaderSettings[K]) => void;

class SettingsStore {
  private state: ReaderSettings = { size: 18, bold: false };
  private listeners: { [K in keyof ReaderSettings]?: Set<Listener<K>> } = {};

  get<K extends keyof ReaderSettings>(key: K): ReaderSettings[K] {
    return this.state[key];
  }

  set<K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]): void {
    if (this.state[key] === value) {
      return;
    }
    this.state = { ...this.state, [key]: value };
    this.listeners[key]?.forEach((listener) => listener(value));
  }

  subscribe<K extends keyof ReaderSettings>(key: K, listener: Listener<K>): () => void {
    const set = this.listeners[key] ?? new Set<Listener<K>>();
    set.add(listener);
    Object.assign(this.listeners, { [key]: set });
    return () => {
      set.delete(listener);
    };
  }
}

export const settings = new SettingsStore();

class SizePreset {
  label: string = '';
  size: number = 0;
}

const PRESETS: SizePreset[] = [
  { label: 'Small', size: 14 },
  { label: 'Medium', size: 18 },
  { label: 'Large', size: 24 },
];

const clamp = (value: number): number => Math.min(30, Math.max(14, value));

@Component
struct SizeControls {
  @State size: number = settings.get('size');
  private unsubscribe?: () => void;

  aboutToAppear(): void {
    this.unsubscribe = settings.subscribe('size', (value) => {
      this.size = value;
    });
  }

  aboutToDisappear(): void {
    this.unsubscribe?.();
  }

  build() {
    Column({ space: 12 }) {
      Row({ space: 16 }) {
        Button('A-')
          .onClick(() => settings.set('size', clamp(this.size - 2)))
        Text(`${this.size}`)
          .fontSize(20)
        Button('A+')
          .onClick(() => settings.set('size', clamp(this.size + 2)))
      }
      Row({ space: 8 }) {
        ForEach(PRESETS, (preset: SizePreset) => {
          Button(preset.label)
            .onClick(() => settings.set('size', preset.size))
        }, (preset: SizePreset) => preset.label)
      }
    }
  }
}

@Component
struct PreviewSentence {
  @State size: number = settings.get('size');
  @State bold: boolean = settings.get('bold');
  private unsubscribers: (() => void)[] = [];

  aboutToAppear(): void {
    this.unsubscribers = [
      settings.subscribe('size', (value) => {
        animateTo({ duration: 300, easing: 'ease-in-out' }, () => {
          this.size = value;
        });
      }),
      settings.subscribe('bold', (value) => {
        this.bold = value;
      }),
    ];
  }

  aboutToDisappear(): void {
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
  }

  build() {
    Text('The quick brown fox')
      .fontSize(this.size)
      .fontWeight(this.bold ? FontWeight.Bold : FontWeight.Normal)
  }
}

@Component
struct ChangeCounter {
  @State changes: number = 0;
  private unsubscribe?: () => void;

  aboutToAppear(): void {
    this.unsubscribe = settings.subscribe('size', () => {
      this.changes += 1;
    });
  }

  aboutToDisappear(): void {
    this.unsubscribe?.();
  }

  build() {
    Text(`Changed ${this.changes} times`)
      .fontSize(16)
  }
}

@Entry
@Component
struct ReaderSettingsPage {
  @State bold: boolean = settings.get('bold');

  build() {
    Column({ space: 20 }) {
      Row({ space: 12 }) {
        Text('Bold')
        Toggle({ type: ToggleType.Switch, isOn: this.bold })
          .onChange((isOn: boolean) => {
            this.bold = isOn;
            settings.set('bold', isOn);
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
