import React from "react";
import { styled } from "@mui/system";

const Separator = styled("div")({
  width: "95%",
  backgroundColor: "var(--border)",
  height: "1px",
  position: "relative",
  marginTop: "20px",
  marginBottom: "10px",
});

const DateLabel = styled("span")({
  backgroundColor: "var(--surface-raised)",
  position: "absolute",
  left: "45%",
  top: "-10px",
  color: "var(--text-muted)",
  padding: "0 5px",
  fontSize: "14px",
});

const DateSeparator = ({ date }) => {
  return (
    <Separator>
      <DateLabel>{date}</DateLabel>
    </Separator>
  );
};

export default DateSeparator;
