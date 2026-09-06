import React from "react";
import { Typography } from "@mui/material";

const FriendsTitle = ({ title }) => {
  return (
    <Typography
      sx={{
        textTransform: "uppercase",
        color: "var(--text-subtle)",
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.06em",
        padding: "var(--space-3) var(--space-2) var(--space-1)",
      }}
    >
      {title}
    </Typography>
  );
};

export default FriendsTitle;
