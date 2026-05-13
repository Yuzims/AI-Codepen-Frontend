import styled from "@emotion/styled";

export const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #f6f8fa;
  overflow: hidden;
`;

export const Header = styled.div`
  padding: 12px 20px;
  background: white;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 100;
  flex-shrink: 0;
`;

export const Container = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  width: 100%;
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  overflow: hidden;
`;

export const Title = styled.h1`
  margin: 0;
  color: #333;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.4;
`;

export const Description = styled.p`
  color: #666;
  margin: 4px 0 0 0;
  font-size: 14px;
  line-height: 1.4;
`;

export const PreviewContainer = styled.div`
  flex: 1;
  background: white;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
`;

export const PreviewHeader = styled.div`
  padding: 8px 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
`;

export const PreviewTitle = styled.div`
  font-size: 13px;
  color: #666;
`;

export const PreviewContent = styled.div`
  flex: 1;
  position: relative;
  overflow: hidden;
  background: white;
  width: 100%;
`;
