import { Construct } from '@aws-cdk/core';

export interface TestProps {
  /**
   * Some string.
   */
  readonly foo: string;

  /**
   * Some number.
   */
  readonly bar: number;

  /**
   * A fixed constant.
   */
  readonly baz: 'asdf';
}

/**
 * Creates an example construct.
 */
export class TestConstruct extends Construct {
  constructor(scope: Construct, id: string, props: TestProps) {
    super(scope, id);
    console.log({ props });
  }
}
