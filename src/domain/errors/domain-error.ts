abstract class DomainError extends Error {
  protected constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

export { DomainError };
