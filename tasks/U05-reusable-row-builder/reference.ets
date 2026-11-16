@Entry
@Component
struct SettingsPage {
  @Builder
  settingRow(icon: string, title: string, value: string) {
    Row({ space: 12 }) {
      Text(icon)
        .fontSize(20)
      Text(title)
        .fontSize(16)
        .layoutWeight(1)
      Text(value)
        .fontSize(14)
        .fontColor(Color.Gray)
    }
    .width('100%')
    .height(48)
  }

  build() {
    Column() {
      this.settingRow('W', 'Wi-Fi', 'Home')
      this.settingRow('B', 'Bluetooth', 'On')
      this.settingRow('L', 'Language', 'English')
      this.settingRow('S', 'Storage', '12 GB free')
    }
    .width('100%')
    .height('100%')
    .padding(16)
  }
}
