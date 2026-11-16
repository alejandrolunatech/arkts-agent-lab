let darkMode: boolean = localStorage.getItem('darkMode') === 'true';

@Component
struct ThemeTitle {
  build() {
    Text(darkMode ? 'Dark mode is on' : 'Dark mode is off')
      .fontSize(20)
  }
}

@Component
struct ThemeCard {
  build() {
    Column() {
      Text('Sample content')
        .fontColor(darkMode ? '#FFFFFF' : '#000000')
    }
    .width('100%')
    .padding(24)
    .borderRadius(12)
    .backgroundColor(darkMode ? '#1C1C1E' : '#F2F2F2')
  }
}

@Entry
@Component
struct ThemePage {
  @State isOn: boolean = darkMode;

  build() {
    Column({ space: 16 }) {
      Row({ space: 12 }) {
        Text('Dark mode')
        Toggle({ type: 'switch', isOn: this.isOn })
          .onChange((value) => {
            darkMode = value;
            this.isOn = value;
            localStorage.setItem('darkMode', String(value));
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
