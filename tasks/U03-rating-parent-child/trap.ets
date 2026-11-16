interface RatingChangeHandler {
  (value: number): void;
}

interface RatingControlProps {
  value: number;
  onChange: RatingChangeHandler;
}

@Component
struct RatingControl {
  props: RatingControlProps = { value: 0, onChange: () => {} };

  build() {
    const { value, onChange } = this.props;

    Row({ space: 12 }) {
      Button('-')
        .onClick(() => onChange(Math.max(0, value - 1)))
      Text(`${value} / 5`)
        .fontSize(20)
      Button('+')
        .onClick(() => onChange(Math.min(5, value + 1)))
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
      RatingControl({
        props: {
          value: this.rating,
          onChange: (value: number) => {
            this.rating = value;
          }
        }
      })
    }
    .width('100%')
    .height('100%')
    .padding(16)
  }
}
