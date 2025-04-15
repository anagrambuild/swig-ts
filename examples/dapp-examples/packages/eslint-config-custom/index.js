module.exports = {
  extends: [
    "eslint:recommended", 
    "plugin:react/recommended", 
    "prettier"
  ],
  settings: {
    react: {
      version: "detect",
    },
  },
  rules: {
    "react/prop-types": "off",
    "react/react-in-jsx-scope": "off",
  },
};
