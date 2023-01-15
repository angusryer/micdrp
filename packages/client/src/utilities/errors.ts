import { AxiosError } from 'axios';
import _ from 'lodash';
import { Platform } from 'react-native';

export enum Errors {
  AxiosError = 'AXIOS_ERROR',
  BaseError = 'BASE_ERROR',
  AppError = 'APP_ERROR',
  TextError = 'MSG_ERROR',
  UserDefinedError = 'USER_DEFINED_ERROR',
  UnknownError = 'UNKNOWN_ERROR'
}

type StandardizedResponse = GenericResponse;

type GenericResponse = {
  status: string;
  statusText: string;
  data: object | undefined;
  headers: object;
  config: object;
  message: string;
} & Record<string | symbol | number, unknown>;

export interface ErrorData {
  type?: Errors;
  message?: string;
  code?: string;
  name?: string;
  stack?: string;
  response?: StandardizedResponse;
}

export type FormattedError<ErrorType = unknown> = Readonly<ErrorData> & {
  readonly __error: ErrorType;
};

const NO_CODE = 'NO_CODE';
const NO_STACK = 'NO_STACK';
const NOT_NETWORK = 'NOT_NETWORK_ERROR';
const GENERIC_MESSAGE = 'NO_MESSAGE';
const GENERIC_NAME = 'Error';
const genericResponse: GenericResponse = {
  status: NOT_NETWORK,
  statusText: GENERIC_MESSAGE,
  message: GENERIC_MESSAGE,
  data: undefined,
  headers: {},
  config: {}
};

/**
 * Constructs a standardized error object that's easy to handle throughout
 * the code base. The constructor may receive an optional data object of type
 * `ErrorData` for adding context to error messages. Any fields in the `data`
 * object will overwrite the same fields in the newly constructed object.
 * The constructor may also receive an optional type parameter to help when
 * creating custom error objects with your custom types. Defaults to `unknown`.
 *
 * AppError extends the built-in Error object type.
 *
 * @param err The original error. Will be available on the `__error` field in the resultant
 * AppError object.
 * @param data Additional data that you can provide as the type ErrorData. This will
 * be merged into the final AppError object and its data will override any of the same fields
 * present in the newly constructed object.
 */
export default class AppError<ErrorType = unknown> extends Error {
  public readonly __error: ErrorType | undefined;
  public readonly type: Errors;
  public readonly code: string;
  public readonly name: string;
  public readonly message: string;
  public readonly stack: string;
  public readonly response: StandardizedResponse;

  private readonly formatted: string;

  constructor(err?: ErrorType, data?: ErrorData) {
    const errType = AppError.getErrorType(err);
    let _err: Required<ErrorData> = {
      type: errType,
      code: NO_CODE,
      name: GENERIC_NAME,
      message: GENERIC_MESSAGE,
      stack: NO_STACK,
      response: genericResponse
    };

    switch (errType) {
      case Errors.TextError:
        if (err) {
          _err.message = String(err);
          _err.name = 'Error';
        }
        break;
      default:
        // We trust lodash so we can disable these linting rules for this line
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        if (_.isObject(err)) {
          _err = keepSrcObjEntriesAndMergeTargetVals<
            Required<ErrorData>,
            object // syntax highlighting doesn't seem to work here
          >(_err, err);
        }
        break;
    }

    if (data) {
      _err = keepSrcObjEntriesAndMergeTargetVals<
        Required<ErrorData>,
        ErrorData
      >(_err, data);
    }

    super(_err.message);

    this.type = errType;
    this.code = _err.code;
    this.name = _err.name;
    this.message = _err.message;
    this.stack = _err.stack;
    this.response = _err.response;
    this.__error = err;

    this.formatted =
      this.name +
      ': ' +
      String(this.type) +
      '\nCode: ' +
      this.code +
      '\nMsg: ' +
      this.message +
      '\nDevice: ' +
      Platform.OS +
      ', ' +
      String(Platform.Version) +
      '\nResp Status: ' +
      this.response.status +
      '\nResp Text: ' +
      this.response.statusText +
      '\nStack: ' +
      this.stack;
  }

  public static getErrorType(err: unknown): Errors {
    if (
      typeof err === 'bigint' ||
      typeof err === 'boolean' ||
      typeof err === 'number' ||
      typeof err === 'string'
    ) {
      return Errors.TextError;
    } else if (
      err instanceof Error &&
      !(err instanceof AppError) &&
      err instanceof AxiosError
    ) {
      return Errors.AxiosError;
    } else if (
      err instanceof Error &&
      !(err instanceof AppError) &&
      !(err instanceof AxiosError)
    ) {
      return Errors.BaseError;
    } else if (
      err instanceof Error &&
      err instanceof AppError &&
      !(err instanceof AxiosError)
    ) {
      return Errors.AppError;
    } else if (
      typeof err === 'object' &&
      !Array.isArray(err) &&
      !['function', 'symbol'].includes(typeof err)
    ) {
      return Errors.UserDefinedError;
    } else {
      return Errors.UnknownError;
    }
  }

  private _format(): FormattedError {
    return {
      __error: this.__error,
      code: this.code,
      message: this.message,
      name: this.name,
      response: this.response,
      stack: this.stack,
      type: this.type
    };
  }

  /**
   * Output the error directly to the console
   * @returns `void`
   */
  public toConsole(
    level?: 'log' | 'warn' | 'error' | 'debug',
    charLimit?: number
  ): void {
    let errString = this.formatted.toString();
    if (charLimit && charLimit > 0) {
      errString = errString.slice(0, charLimit);
    }
    if (level) {
      console[level](errString);
    } else {
      console.error(errString);
    }
  }

  /**
   * An override of the static toString() method
   */
  public override toString(charLimit?: number) {
    let errString = this.formatted.toString();
    if (charLimit && charLimit > 0) {
      errString = errString.slice(0, charLimit);
    }
    return errString;
  }

  /**
   * Provide a custom error handler that receives a consistent error object
   * @param cb (err: FormattedError) => void | (err: FormattedError) => Promise\<void\>
   * @returns `void`
   */
  public handle(
    cb: (
      err: FormattedError
    ) => undefined | ((err: FormattedError) => Promise<undefined>)
  ): void {
    cb(this._format());
  }
}

/**
 * Takes a source and a target object and merges them such that the source object
 * is retained except for its values where the target values are different.
 *
 * This method will *not* retain additional keys provided in the target object.
 *
 * @param primary
 * @param secondary
 * @returns {Primary} a new object with source keys and target values where they differ from the source
 */
export function keepSrcObjEntriesAndMergeTargetVals<
  Primary extends object,
  Secondary extends object
>(primary: Primary, secondary: Secondary): Primary {
  const sourceKeys = Object.keys(primary);
  const newObject = { ...primary };
  sourceKeys.forEach((key) => {
    if (Object.getOwnPropertyDescriptor(secondary, key)) {
      Object.defineProperty(newObject, key, {
        value: secondary[key as keyof Secondary],
        enumerable: true
      });
    } else {
      Object.defineProperty(newObject, key, {
        value: primary[key as keyof Primary],
        enumerable: true
      });
    }
  });
  return newObject;
}
