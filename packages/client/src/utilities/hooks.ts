import { createContext, useContext } from 'react';
import AppError from './errors';

/**
 * Use this context provider to guard against undefined values within
 * functional context providers. Provide it the type you'd like to have
 * your context defined in, but initialize it without any arguments.
 *
 * @returns useDefinedContext hook and the context provider itself
 */
export function createDefinedContext<ContextType>() {
  const context = createContext<ContextType | undefined>(undefined);
  
  const useDefinedContext = () => {
    const definedContext = useContext(context);
    if (!definedContext) {
      throw new AppError(
        'useDefinedContext must be used within a context provider'
      );
    }
    return definedContext;
  };
  return [useDefinedContext, context] as const;
}
