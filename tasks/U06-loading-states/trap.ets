type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; articles: string[] };

@Entry
@Component
struct ArticlesPage {
  @State state: LoadState = { status: 'loading' };

  build() {
    if (this.state.status === 'loading') {
      return Column({ space: 16 }) {
        Text('Loading...')
          .fontSize(20)
        Button('Finish loading')
          .onClick(() => {
            this.state = { status: 'loaded', articles: ['First article', 'Second article', 'Third article'] };
          })
        Button('Fail loading')
          .onClick(() => {
            this.state = { status: 'error', message: 'Could not load the articles.' };
          })
      }
    }

    if (this.state.status === 'error') {
      return Column({ space: 16 }) {
        Text(this.state.message)
          .fontSize(20)
          .fontColor(Color.Red)
        Button('Retry')
          .onClick(() => {
            this.state = { status: 'loading' };
          })
      }
    }

    return Column({ space: 16 }) {
      ForEach(this.state.articles, (article: string) => {
        Text(article)
          .fontSize(18)
      }, (article: string) => article)
    }
  }
}
