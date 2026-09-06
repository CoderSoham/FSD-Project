import React from "react";
import Button from "@mui/material/Button";

const CustomPrimaryButton = ({
  label,
  additionalStyles,
  disabled,
  onClick,
}) => {
  return (
    <Button
      variant="contained"
      sx={{
        bgcolor: "var(--accent)",
        // Text sitting on a filled accent has to be the on-accent colour, not
        // the body colour, or it inverts with the theme and stops being
        // readable. Measured 2.82:1 before this.
        color: "var(--text-on-accent)",
        textTransform: "none",
        fontSize: "16px",
        fontWeight: 500,
        width: "100%",
        height: "40px",
        "&:hover": { bgcolor: "var(--accent-hover)" },
      }}
      style={additionalStyles ? additionalStyles : {}}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </Button>
  );
};

export default CustomPrimaryButton;
