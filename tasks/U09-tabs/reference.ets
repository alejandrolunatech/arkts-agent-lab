@Entry
@Component
struct TabsPage {
  @State currentIndex: number = 0;
  private tabNames: string[] = ['Home', 'Search', 'Profile'];

  build() {
    Column() {
      Text(`Current tab: ${this.tabNames[this.currentIndex]}`)
        .fontSize(18)
        .padding(12)
      Tabs({ barPosition: BarPosition.End }) {
        TabContent() {
          Text('Welcome home')
        }
        .tabBar('Home')

        TabContent() {
          Text('Search for something')
        }
        .tabBar('Search')

        TabContent() {
          Text('Your profile')
        }
        .tabBar('Profile')
      }
      .onChange((index: number) => {
        this.currentIndex = index;
      })
      .layoutWeight(1)
    }
    .width('100%')
    .height('100%')
  }
}
