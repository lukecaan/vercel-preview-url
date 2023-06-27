export async function wait(milliseconds: number): Promise<string> {
  return new Promise(resolve => {
    setTimeout(() => resolve('done!'), milliseconds)
  })
}
