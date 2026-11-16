import { preferences } from '@kit.ArkData';

const NAME_KEY: string = 'userName';
const store = preferences.getPreferencesSync({ name: 'profile' });

@Entry
@Component
struct NamePage {
  @State draft: string = '';
  @State savedName: string = '';

  aboutToAppear(): void {
    this.savedName = store.getSync(NAME_KEY, '');
    this.draft = this.savedName;
  }

  async saveName(): Promise<void> {
    await store.set(NAME_KEY, this.draft);
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
