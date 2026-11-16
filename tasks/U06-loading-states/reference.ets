enum LoadStatus {
  Loading,
  Failed,
  Loaded
}

@Entry
@Component
struct ArticlesPage {
  @State status: LoadStatus = LoadStatus.Loading;
  @State articles: string[] = [];

  build() {
    Column({ space: 16 }) {
      if (this.status === LoadStatus.Loading) {
        Text('Loading...')
          .fontSize(20)
        Button('Finish loading')
          .onClick(() => {
            this.articles = ['First article', 'Second article', 'Third article'];
            this.status = LoadStatus.Loaded;
          })
        Button('Fail loading')
          .onClick(() => {
            this.status = LoadStatus.Failed;
          })
      } else if (this.status === LoadStatus.Failed) {
        Text('Could not load the articles.')
          .fontSize(20)
          .fontColor(Color.Red)
        Button('Retry')
          .onClick(() => {
            this.status = LoadStatus.Loading;
          })
      } else {
        ForEach(this.articles, (article: string) => {
          Text(article)
            .fontSize(18)
        }, (article: string) => article)
      }
    }
    .width('100%')
    .height('100%')
    .padding(16)
  }
}
