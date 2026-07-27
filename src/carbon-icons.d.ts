declare module "@carbon/icons/es/*" {
  const icon: {
    elem: string;
    attrs: Record<string, string | number>;
    content?: typeof icon[];
  };

  export default icon;
}
