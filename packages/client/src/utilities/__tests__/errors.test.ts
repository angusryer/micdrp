import { AxiosError } from 'axios';
import AppError, { Errors } from '../errors';

/* eslint-disable @typescript-eslint/no-throw-literal */

describe('AppError Class', () => {
  it('properly creates an AppError of type TextError when a text message is thrown', () => {
    try {
      throw 'test error';
    } catch (err) {
      const newError = new AppError(err);
      expect(newError.type).toEqual(Errors.TextError);
    }
  });

  it('properly displays `Error: test message` when a text message is thrown', () => {
    try {
      throw 'test message';
    } catch (err) {
      const newError = new AppError(err);
      expect(newError).toEqual(Error('test message'));
    }
  });

  it('properly creates an AppError of type BaseError when an Error is thrown', () => {
    try {
      throw Error();
    } catch (err) {
      const newError = new AppError(err);
      expect(newError.type).toEqual(Errors.BaseError);
    }
  });

  it('properly creates an AppError of type AppError when an AppError is thrown', () => {
    try {
      throw new AppError();
    } catch (err) {
      const newError = new AppError(err);
      expect(newError.type).toEqual(Errors.AppError);
    }
  });

  it('properly creates an AppError of type AxiosError when an AxiosError is thrown', () => {
    try {
      throw new AxiosError();
    } catch (err) {
      const newError = new AppError(err);
      expect(newError.type).toEqual(Errors.AxiosError);
    }
  });

  it('properly creates an AppError of type UserDefinedError when a custom object is thrown', () => {
    try {
      throw { test: 'error' };
    } catch (err) {
      const newError = new AppError(err);
      expect(newError.type).toEqual(Errors.UserDefinedError);
    }
  });

  it('properly creates an AppError of type UnkownError when an unknown type is thrown', () => {
    try {
      throw new Array(10);
    } catch (err) {
      const newError = new AppError(err);
      expect(newError.type).toEqual(Errors.UnknownError);
    }
  });

  it('AppError object contains custom user properties when a custom object is thrown', () => {
    const customThrownObject = { test: 'error', message: 'test message' };
    try {
      throw customThrownObject;
    } catch (err) {
      const newError = new AppError(err);
      expect(newError.__error).toEqual(customThrownObject);
      expect(newError.message).toEqual(customThrownObject.message);
    }
  });

  it('instantiates an AppError object when arg is not provided', () => {
    const err = new AppError();
    expect(err).toBeInstanceOf(AppError);
  });

  it('instantiates an AppError object when arg is undefined', () => {
    const err = new AppError(undefined);
    expect(err).toBeInstanceOf(AppError);
  });

  it('instantiates an AppError object when arg is null', () => {
    const err = new AppError(null);
    expect(err).toBeInstanceOf(AppError);
  });

  it('instantiates an AppError object when arg is a string', () => {
    const err = new AppError('test error');
    expect(err).toBeInstanceOf(AppError);
  });

  it('instantiates an AppError object when arg is a number', () => {
    const err = new AppError(42);
    expect(err).toBeInstanceOf(AppError);
  });

  it('instantiates an AppError object when arg is an Error object', () => {
    const err = new AppError(new Error());
    expect(err).toBeInstanceOf(AppError);
  });

  it('instantiates an AppError object when arg is an AppError object', () => {
    const err = new AppError(new AppError());
    expect(err).toBeInstanceOf(AppError);
  });

  it('instantiates an AppError object when arg is a custom object', () => {
    const err = new AppError({ test: 'error' });
    expect(err).toBeInstanceOf(AppError);
  });
});
