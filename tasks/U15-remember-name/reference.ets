import { preferences } from '@kit.ArkData';

const STORE_NAME: string = 'profile';
const NAME_KEY: string = 'userName';

@Entry
@Component
struct NamePage {
  @State draft: string = '';
  @State savedName: string = '';

  aboutToAppear(): void {
    this.loadName();
  }

  async openStore(): Promise<preferences.Preferences> {
    return preferences.getPreferences(getContext(this), STORE_NAME);
  }

  async loadName(): Promise<void> {
    const store = await this.openStore();
    const value = await store.get(NAME_KEY, '');
    this.savedName = value as string;
    this.draft = this.savedName;
  }

  async saveName(): Promise<void> {
    const store = await this.openStore();
    await store.put(NAME_KEY, this.draft);
    await store.flush();
    this.savedName = this.draft;
  }

  build() {
    Column({ space: 12 }) {
      Text(this.savedName.length > 0 ? `Hello, ${this.savedName}` : 'No name saved')
        .fontSize(20)
      TextInput({ placeholder: 'Your name', text: this.draft })
        .onChange((value: string) => {
          this.draft = value;
        })
      Button('Save')
        .onClick(() => {
          this.saveName();
        })
    }
    .width('100%')
    .height('100%')
    .padding(16)
  }
}
