@Component
struct RatingControl {
  @Link rating: number;

  build() {
    Row({ space: 12 }) {
      Button('-')
        .onClick(() => {
          if (this.rating > 0) {
            this.rating -= 1;
          }
        })
      Text(`${this.rating} / 5`)
        .fontSize(20)
      Button('+')
        .onClick(() => {
          if (this.rating < 5) {
            this.rating += 1;
          }
        })
    }
  }
}

@Entry
@Component
struct RatingPage {
  @State rating: number = 3;

  build() {
    Column({ space: 16 }) {
      Text(`Your rating: ${this.rating}`)
        .fontSize(24)
      RatingControl({ rating: this.rating })
    }
    .width('100%')
    .height('100%')
    .padding(16)
  }
}
