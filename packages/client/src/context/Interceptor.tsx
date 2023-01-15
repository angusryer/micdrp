export {};
// import axios, { AxiosError, AxiosRequestConfig } from 'axios';
// import createAuthRefreshInterceptor from 'axios-auth-refresh';
// import React, { createContext, ReactElement, useContext, useEffect, useState } from 'react';
// import Config from 'react-native-config';
// import { useAuth } from '../context/AuthContext';
// import { getAccessToken } from './auth0';

// export const axiosInstance = axios.create({
//   baseURL: Config.API_URL,
// });

// interface IProps {
//   children: ReactElement;
// }

// let interceptorReqValue = -1;
// let interceptorResValue = -1;
// let authInterceptorValue = -1;

// const AxiosInterceptors = ({ children }: IProps): JSX.Element => {
//   const auth = useAuth();
//   // Return the timezone offset (in minutes) for the current Browser platform. This
//   // is the number of minutes that the current timezone would have to add to a Date in
//   // order to calculated the current UTC time.
//   const getTimezoneOffset = (): string => {
//     return String(new Date().getTimezoneOffset());
//   };

//   const [loading, setLoading] = useState<boolean>(true);
//   const [forbidden, setForbidden] = useState<boolean>(false);

//   useEffect(() => {
//     try {
//       setLoading(true);
//       if (!auth.isLoading && auth.isLoggedIn) {
//         // Function that will be called to refresh authorization
//         // Instantiate the interceptor
//         if (authInterceptorValue === -1) {
//           authInterceptorValue = createAuthRefreshInterceptor(axiosInstance, () => auth.refresh());
//         }

//         const resInterceptor = (response: any) => {
//           return response;
//         };
//         const errInterceptor = (error: AxiosError) => {
//           if (error?.response?.status === 403) {
//             setForbidden(true);
//           }
//           return Promise.reject(error);
//         };
//         if (interceptorReqValue > -1) {
//           axiosInstance.interceptors.request.eject(interceptorReqValue);
//         }
//         let interceptor: number = axiosInstance.interceptors.request.use(
//           async (config: AxiosRequestConfig) => {
//             if (config.headers) {
//               config.headers['Content-Type'] = 'application/json';
//               config.headers['X-Timezone-Offset'] = getTimezoneOffset();
//               const token = await getAccessToken();
//               if (token) {
//                 config.headers.Authorization = `Bearer ${token}`;
//               }
//             }
//             return config;
//           },
//           (error) => {
//             return Promise.reject(error);
//           }
//         );
//         interceptorReqValue = interceptor;

//         if (interceptorResValue > -1) {
//           axiosInstance.interceptors.response.eject(interceptorResValue);
//         }
//         interceptor = axiosInstance.interceptors.response.use(resInterceptor, errInterceptor);
//         interceptorResValue = interceptor;
//         setLoading(false);
//         //return () => axiosInstance.interceptors.response.eject(interceptor);
//       }
//     } catch (err) {
//       console.error('Interceptor failure: ', err);
//     }
//   }, [auth.isLoading, auth.isLoggedIn]);

//   return (
//     <InterceptorContext.Provider
//       value={{
//         loading,
//         forbidden,
//       }}
//     >
//       {children}
//     </InterceptorContext.Provider>
//   );
// };

// type InterceptorContextData = {
//   /**
//    * Used during initialization, will be true after it has been initialized with a token
//    */
//   loading: boolean;
//   /**
//    * If an incerceptor has encountered a Forbidden Response. This will likely mean the user is not a Paid Member.
//    */
//   forbidden: boolean;
// };
// const InterceptorContext = createContext<InterceptorContextData>({} as InterceptorContextData);
// function useInterceptors(): InterceptorContextData {
//   const context = useContext(InterceptorContext);

//   if (!context) {
//     throw new Error('userInterceptors must be used within an AxiosInterceptor');
//   }

//   return context;
// }

// const http = () => {
//   return axiosInstance;
// };

// export default http;
// export { AxiosInterceptors, useInterceptors, InterceptorContext };
