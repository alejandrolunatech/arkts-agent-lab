@Entry
@Component
struct CounterPage {
  @State count: number = 0;

  build() {
    Column({ space: 12 }) {
      Text(`${this.count}`)
        .fontSize(32)
      Button('Add')
        .onClick(() => {
          this.count += 1;
        })
      Button('Reset')
        .onClick(() => {
          this.count = 0;
        })
    }
    .width('100%')
    .height('100%')
  }
}
