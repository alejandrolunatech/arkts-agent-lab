@Component
struct ThemeTitle {
  @StorageProp('darkMode') darkMode: boolean = false;

  build() {
    Text(this.darkMode ? 'Dark mode is on' : 'Dark mode is off')
      .fontSize(20)
  }
}

@Component
struct ThemeCard {
  @StorageProp('darkMode') darkMode: boolean = false;

  build() {
    Column() {
      Text('Sample content')
        .fontColor(this.darkMode ? '#FFFFFF' : '#000000')
    }
    .width('100%')
    .padding(24)
    .borderRadius(12)
    .backgroundColor(this.darkMode ? '#1C1C1E' : '#F2F2F2')
  }
}

@Entry
@Component
struct ThemePage {
  @StorageLink('darkMode') darkMode: boolean = false;

  build() {
    Column({ space: 16 }) {
      Row({ space: 12 }) {
        Text('Dark mode')
        Toggle({ type: ToggleType.Switch, isOn: this.darkMode })
          .onChange((isOn: boolean) => {
            this.darkMode = isOn;
          })
      }
      ThemeTitle()
      ThemeCard()
    }
    .width('100%')
    .height('100%')
    .padding(16)
  }
}
