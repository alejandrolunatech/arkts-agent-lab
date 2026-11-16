const styles = {
  card: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F1F3F5'
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#182431'
  }
};

@Entry
@Component
struct OverviewPage {
  build() {
    Column({ space: 12 }) {
      Column({ space: 4 }) {
        Text('Storage')
          .style(styles.title)
        Text('12 GB free')
      }
      .alignItems(HorizontalAlign.Start)
      .style(styles.card)

      Column({ space: 4 }) {
        Text('Battery')
          .style(styles.title)
        Text('80 %')
      }
      .alignItems(HorizontalAlign.Start)
      .style(styles.card)

      Column({ space: 4 }) {
        Text('Network')
          .style(styles.title)
        Text('Wi-Fi')
      }
      .alignItems(HorizontalAlign.Start)
      .style(styles.card)
    }
    .width('100%')
    .height('100%')
    .padding(16)
  }
}
