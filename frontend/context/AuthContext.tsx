"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState
} from "react";

type AuthContextType = {
  isLoggedIn: boolean;
  setIsLoggedIn: (value: boolean) => void;
};

const AuthContext = createContext<AuthContextType>({
  isLoggedIn: false,
  setIsLoggedIn: () => {},
});

export const AuthProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {

  const [isLoggedIn, setIsLoggedIn] =
    useState(false);

  useEffect(() => {

    const token =
      localStorage.getItem("token");

    setIsLoggedIn(!!token);

  }, []);

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn,
        setIsLoggedIn,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};