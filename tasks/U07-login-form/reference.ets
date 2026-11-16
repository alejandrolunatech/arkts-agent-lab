function isValidEmail(email: string): boolean {
  const at = email.indexOf('@');
  const dot = email.lastIndexOf('.');
  return at > 0 && at === email.lastIndexOf('@') && dot > at + 1 && dot < email.length - 1;
}

function isValidPassword(password: string): boolean {
  return password.length >= 8;
}

@Entry
@Component
struct LoginPage {
  @State email: string = '';
  @State password: string = '';

  build() {
    Column({ space: 12 }) {
      TextInput({ placeholder: 'Email', text: this.email })
        .type(InputType.Email)
        .onChange((value: string) => {
          this.email = value;
        })
      if (this.email.length > 0 && !isValidEmail(this.email)) {
        Text('Enter a valid email address')
          .fontSize(12)
          .fontColor(Color.Red)
      }

      TextInput({ placeholder: 'Password', text: this.password })
        .type(InputType.Password)
        .onChange((value: string) => {
          this.password = value;
        })
      if (this.password.length > 0 && !isValidPassword(this.password)) {
        Text('Password must be at least 8 characters')
          .fontSize(12)
          .fontColor(Color.Red)
      }

      Button('Sign in')
        .width('100%')
        .enabled(isValidEmail(this.email) && isValidPassword(this.password))
        .onClick(() => {
          console.info('Sign in requested');
        })
    }
    .width('100%')
    .height('100%')
    .padding(16)
  }
}
