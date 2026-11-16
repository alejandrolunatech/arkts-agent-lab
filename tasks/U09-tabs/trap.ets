const TAB_NAMES = ['Home', 'Search', 'Profile'];

@Entry
@Component
struct Tabs {
  @State activeTab: number = 0;

  build() {
    Column() {
      Text(`Current tab: ${TAB_NAMES[this.activeTab]}`)
        .fontSize(18)
        .padding(12)

      Row() {
        TAB_NAMES.map((name, index) =>
          Button(name)
            .onPress(() => {
              this.activeTab = index;
            })
        )
      }

      this.activeTab === 0 && Text('Welcome home')
      this.activeTab === 1 && Text('Search for something')
      this.activeTab === 2 && Text('Your profile')
    }
    .width('100%')
    .height('100%')
  }
}
