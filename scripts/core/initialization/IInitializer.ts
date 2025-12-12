/**
 * Interface for initializing pack features
 * Follows Dependency Inversion Principle - depend on abstraction, not concrete implementations
 * Follows Interface Segregation Principle - focused single method
 */
export interface IInitializer {
  /**
   * Initializes a feature or system
   */
  initialize(): void;
}
