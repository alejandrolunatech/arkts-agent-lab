@Styles
function cardStyle() {
  .width('100%')
  .padding(16)
  .borderRadius(12)
  .backgroundColor('#F1F3F5')
}

@Extend(Text)
function cardTitle() {
  .fontSize(18)
  .fontWeight(FontWeight.Bold)
  .fontColor('#182431')
}

@Entry
@Component
struct OverviewPage {
  build() {
    Column({ space: 12 }) {
      Column({ space: 4 }) {
        Text('Storage')
          .cardTitle()
        Text('12 GB free')
      }
      .alignItems(HorizontalAlign.Start)
      .cardStyle()

      Column({ space: 4 }) {
        Text('Battery')
          .cardTitle()
        Text('80 %')
      }
      .alignItems(HorizontalAlign.Start)
      .cardStyle()

      Column({ space: 4 }) {
        Text('Network')
          .cardTitle()
        Text('Wi-Fi')
      }
      .alignItems(HorizontalAlign.Start)
      .cardStyle()
    }
    .width('100%')
    .height('100%')
    .padding(16)
  }
}
