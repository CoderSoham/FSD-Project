import React from "react";
import { styled } from "@mui/system";
import AddFriendButton from "./AddFriendButton";
import FriendsTitle from "./FriendsTitle";
import FriendsList from "./FriendsList/FriendsList";
import PendingInvitationsList from "./PendingInvitationsList/PendingInvitationsList";

const MainContainer = styled("div")({
  width: "var(--sidebar-width)",
  height: "100%",
  flex: "none",
  display: "flex",
  flexDirection: "column",
  // Was centred, which pushed the section labels into the middle of the column
  // and left a large gap between the friends list and the invitations.
  alignItems: "stretch",
  padding: "var(--space-3)",
  gap: "var(--space-1)",
  backgroundColor: "var(--surface)",
  borderRight: "1px solid var(--border)",
  overflowY: "auto",
});

const FriendsSideBar = () => {
  return (
    <MainContainer>
      <FriendsTitle title="Direct messages" />
      <FriendsList />
      <FriendsTitle title="Invitations" />
      <PendingInvitationsList />
      {/* Adding a friend is an occasional action, so it sits at the bottom
          rather than being the first and loudest thing in the column. */}
      <div style={{ marginTop: "auto", paddingTop: "var(--space-3)" }}>
        <AddFriendButton />
      </div>
    </MainContainer>
  );
};

export default FriendsSideBar;
