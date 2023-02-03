import React, { useEffect, useState } from 'react';
import AppError from '../utilities/errors';
import { createDefinedContext } from '../utilities/hooks';
import { createMachine } from '../utilities/machine';

const mockUser: IAccount = {
  id: '1',
  name: 'Angus',
  email: 'person@person.com',
  theme: {}
};

const accountMachine =
  /** @xstate-layout N4IgpgJg5mDOIC5QAoC2BDAxgCwJYDswBKAOlwgBswBiAZQFUAhAWQEkAVAbQAYBdRUAAcA9rFwAXXMPwCQAD0QBGAOwA2EgGYALGoCsqgEy6ANCACeSxQE4Si7ov1GAvk9NoseQqQrD0EAlDUAAoAggCazACiAHLsAPoASpEAwpGsAGqRACI8-EggImKS0rIKCAYG6ty6WqoAHMom5ogAtKpaJBWVjroubhg4BMQkPn4BweFRsXEAYiGsADLZubKFElIy+WUtBtwaJIZ1VtyGTRYIita29j19IO6DXiRgAE4vwi90TGxcfKui6xKW1aBmU3BIJ3aJyMpnObQ6XVUtzu+GEEDgsgenmI-yKG1KrQ0ijqENUUNOsNaDkUJGUFSRpzuWKGpHIVFxgM2oDKBlpumUdUUMOa5V0+w03DquisGkaTIG2O8vn8+CgHOKXPkiG4lIQGjq6l6rnuCpZzzeH3V+OBCB1It0BkU8o8ZtgAFdMJg4PB8msNQTbbqkboSEaXEA */
  createMachine({
    initial: 'idle',
    states: {
      idle: {
        on: {
          LOGIN: 'loading'
        }
      },
      loading: {
        on: {
          LOGIN_SUCCESSFUL: 'success',
          LOGIN_FAILED: 'error'
        }
      },
      error: {
        on: {
          LOGIN: 'loading'
        }
      },
      success: {
        type: 'final'
      }
    }
  });

interface IAccountContext extends IAccount {
  isLoading: boolean;
  login: () => Promise<IAccount>;
  logout: () => Promise<void>;
}

interface IAccountProviderProps {
  children: JSX.Element;
}

const [useAccount, AccountContext] = createDefinedContext<IAccountContext>();

export default function UserProvider({ children }: IAccountProviderProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [account, setAccount] = useState<IAccount>();

  useEffect(() => {
    login()
      .then((account: IAccount) => setAccount(account))
      .catch((err: unknown) => new AppError(err))
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (): Promise<IAccount> => {
    return new Promise((resolve, reject) => {
      setTimeout(() => resolve(mockUser), 2000);
    });
  };

  const logout = async (): Promise<void> => {
    setAccount(undefined);
    return Promise.resolve();
  };

  return !account ? null : (
    <AccountContext.Provider value={{ ...account, isLoading, login, logout }}>
      {children}
    </AccountContext.Provider>
  );
}
